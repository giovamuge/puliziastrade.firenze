import * as v from 'valibot';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { REVIEW_OUTCOMES, type ApiErrorCode, type ReviewDto, type StreetReviewsResponse } from '$lib/api/contracts';
import { parseIsoDate, toIsoDate } from '$lib/domain/civil-date';
import type { CityDataset } from '$lib/domain/city-dataset';
import type { RomeInstant } from '$lib/domain/rome-clock';
import { ruleFrom, ruleMatchesDay } from '$lib/domain/schedule';
import { getRedis } from '../redis';
import { MemoryReviewStore, RedisReviewStore, type ReviewStore } from './review-store';

export const ReviewInputSchema = v.object({
	street: v.pipe(v.string(), v.regex(/^[a-z0-9-]{1,120}$/)),
	segment: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(32)))),
	date: v.pipe(v.string(), v.isoDate()),
	outcome: v.picklist(REVIEW_OUTCOMES),
	rating: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)))),
	note: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(280)))),
	/** Minutes from midnight read on the street sign, if different from the data. */
	signFrom: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1440)))),
	signTo: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1440)))),
	/** Honeypot: humans never fill it. */
	website: v.optional(v.string())
});
export type ReviewInput = v.InferOutput<typeof ReviewInputSchema>;

/** Verifications are accepted for sweeps started in the last few days. */
const VERIFY_WINDOW_DAYS = 3;
const HOURLY_LIMIT = 20;

export class ReviewError extends Error {
	constructor(
		readonly status: 400 | 404 | 409 | 429 | 503,
		readonly code: ApiErrorCode
	) {
		super(code);
	}
}

function sanitizeNote(note: string | null | undefined): string | null {
	const clean = (note ?? '')
		.replace(/[\u0000-\u001f\u007f<>]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return clean ? clean.slice(0, 280) : null;
}

/** Sweep days, within the verification window, that have already started. */
export function verifiableDays(city: CityDataset, street: number, now: RomeInstant): number[] {
	const days: number[] = [];
	const start = city.streetRuleOffsets[street]!;
	const end = city.streetRuleOffsets[street + 1]!;
	for (let day = now.day; day > now.day - VERIFY_WINDOW_DAYS; day--) {
		for (let i = start; i < end; i++) {
			const rule = city.streetRules[i]!;
			if (ruleMatchesDay(city.rules, rule, day) && (day < now.day || now.minute >= ruleFrom(city.rules, rule))) {
				days.push(day);
				break;
			}
		}
	}
	return days;
}

/** Anonymous, daily-rotating client key: no IP is ever stored. */
export async function anonymousClientKey(ip: string, userAgent: string, day: number): Promise<string> {
	// Never a salt that ships in the source: fall back to the Redis token, a secret every
	// production setup with reviews already has. The constant only serves the in-memory dev store.
	const salt = env.RATE_LIMIT_SALT || env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || 'puliziastrade-dev-salt';
	const data = new TextEncoder().encode(`${salt}|${ip}|${userAgent}|${day}`);
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
	let hex = '';
	for (let i = 0; i < 12; i++) hex += digest[i]!.toString(16).padStart(2, '0');
	return hex;
}

export class ReviewService {
	constructor(private readonly store: ReviewStore | null) {}

	get enabled(): boolean {
		return this.store !== null;
	}

	async forStreet(city: CityDataset, street: number, now: RomeInstant): Promise<StreetReviewsResponse> {
		const slug = city.streets[street]!.slug;
		const verifiableDates = verifiableDays(city, street, now).map(toIsoDate);
		if (!this.store) return { enabled: false, aggregate: emptyAggregate(), reviews: [], verifiableDates };
		const [aggregate, reviews] = await Promise.all([this.store.aggregate(slug), this.store.list(slug, 10)]);
		return { enabled: true, aggregate, reviews, verifiableDates };
	}

	async summary() {
		return { enabled: this.enabled, streets: this.store ? await this.store.summary() : {} };
	}

	async submit(city: CityDataset, input: ReviewInput, clientKey: string, now: RomeInstant): Promise<ReviewDto | null> {
		if (!this.store) throw new ReviewError(503, 'reviews_disabled');
		if (input.website) return null; // bot: accept silently, store nothing

		const street = city.streetBySlug(input.street);
		if (street < 0) throw new ReviewError(404, 'not_found');
		const day = parseIsoDate(input.date);
		if (!verifiableDays(city, street, now).includes(day)) {
			throw new ReviewError(400, 'verify_window');
		}
		let segment: string | null = null;
		if (input.segment) {
			const arc = city.arcByCode(input.segment);
			if (arc < 0 || city.arcStreet[arc] !== street) throw new ReviewError(400, 'segment_mismatch');
			segment = input.segment;
		}

		if ((await this.store.hit(clientKey, 3600)) > HOURLY_LIMIT) {
			throw new ReviewError(429, 'rate_limited');
		}
		if (!(await this.store.claimOnce(`${clientKey}:${input.street}:${input.date}`, VERIFY_WINDOW_DAYS * 86400))) {
			throw new ReviewError(409, 'duplicate');
		}

		const review: ReviewDto = {
			id: crypto.randomUUID(),
			street: input.street,
			segment,
			date: input.date,
			outcome: input.outcome,
			rating: input.outcome === 'skipped' ? null : (input.rating ?? null),
			note: sanitizeNote(input.note),
			signWindow:
				input.signFrom != null && input.signTo != null && input.signTo > input.signFrom ? { from: input.signFrom, to: input.signTo } : null,
			createdAt: new Date().toISOString()
		};
		await this.store.add(review);
		return review;
	}
}

function emptyAggregate() {
	return { count: 0, outcomes: { clean: 0, partial: 0, dirty: 0, skipped: 0 }, ratingAverage: null, lastDate: null, signMismatch: 0 };
}

let service: ReviewService | undefined;

export function getReviewService(): ReviewService {
	if (!service) {
		const redis = getRedis();
		service = new ReviewService(redis ? new RedisReviewStore(redis) : dev ? new MemoryReviewStore() : null);
	}
	return service;
}
