import type { Redis } from "@upstash/redis";
import {
	REVIEW_OUTCOMES,
	type ReviewAggregateDto,
	type ReviewDto,
} from "$lib/api/contracts";

/** Persistence port for citizen verifications. */
export interface ReviewStore {
	add(review: ReviewDto): Promise<void>;
	list(street: string, limit: number): Promise<ReviewDto[]>;
	aggregate(street: string): Promise<ReviewAggregateDto>;
	/** Aggregates for every street reviewed in the current and previous month. */
	summary(): Promise<Record<string, ReviewAggregateDto>>;
	/** Returns true only the first time `key` is claimed within `ttlSeconds`. */
	claimOnce(key: string, ttlSeconds: number): Promise<boolean>;
	/** Increments a fixed-window counter and returns the new value. */
	hit(key: string, windowSeconds: number): Promise<number>;
}

/** Aggregate encoded in a Redis hash field: counts per outcome + rating sum/count + last date. */
interface PackedAggregate {
	o: [number, number, number, number];
	rs: number;
	rn: number;
	l: string | null;
	/** Sign-mismatch reports (optional: older records lack it). */
	sm?: number;
}

const emptyPacked = (): PackedAggregate => ({
	o: [0, 0, 0, 0],
	rs: 0,
	rn: 0,
	l: null,
	sm: 0,
});

function mergePacked(
	into: PackedAggregate,
	from: PackedAggregate
): PackedAggregate {
	for (let i = 0; i < 4; i++) into.o[i] = (into.o[i] ?? 0) + (from.o[i] ?? 0);
	into.rs += from.rs;
	into.rn += from.rn;
	into.sm = (into.sm ?? 0) + (from.sm ?? 0);
	if (from.l && (!into.l || from.l > into.l)) into.l = from.l;
	return into;
}

function unpack(p: PackedAggregate): ReviewAggregateDto {
	return {
		count: p.o.reduce((a, b) => a + b, 0),
		outcomes: {
			clean: p.o[0],
			partial: p.o[1],
			dirty: p.o[2],
			skipped: p.o[3],
		},
		ratingAverage: p.rn > 0 ? Math.round((p.rs / p.rn) * 10) / 10 : null,
		lastDate: p.l,
		signMismatch: p.sm ?? 0,
	};
}

function packReview(r: ReviewDto): PackedAggregate {
	const p = emptyPacked();
	p.o[REVIEW_OUTCOMES.indexOf(r.outcome)] = 1;
	if (r.rating) {
		p.rs = r.rating;
		p.rn = 1;
	}
	p.l = r.date;
	p.sm = r.signWindow ? 1 : 0;
	return p;
}

const monthKey = (date: Date): string => date.toISOString().slice(0, 7);

function recentMonths(now = new Date()): [string, string] {
	const previous = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)
	);
	return [monthKey(now), monthKey(previous)];
}

const KEY_LIST = (street: string) => `rv:list:${street}`;
const KEY_MONTH = (month: string) => `rv:sum:${month}`;
const LIST_LIMIT = 50;
const MONTH_TTL_SECONDS = 70 * 24 * 3600;

export class RedisReviewStore implements ReviewStore {
	constructor(private readonly redis: Redis) {}

	async add(review: ReviewDto): Promise<void> {
		const month = KEY_MONTH(monthKey(new Date()));
		const current = await this.redis.hget<string>(month, review.street);
		const merged = mergePacked(
			current ? (JSON.parse(current) as PackedAggregate) : emptyPacked(),
			packReview(review)
		);
		await this.redis
			.pipeline()
			.lpush(KEY_LIST(review.street), JSON.stringify(review))
			.ltrim(KEY_LIST(review.street), 0, LIST_LIMIT - 1)
			.hset(month, { [review.street]: JSON.stringify(merged) })
			.expire(month, MONTH_TTL_SECONDS)
			.exec();
	}

	async list(street: string, limit: number): Promise<ReviewDto[]> {
		const raw = await this.redis.lrange<string>(
			KEY_LIST(street),
			0,
			limit - 1
		);
		return raw.map((r) => JSON.parse(r) as ReviewDto);
	}

	async aggregate(street: string): Promise<ReviewAggregateDto> {
		const [a, b] = recentMonths();
		const [x, y] = await Promise.all([
			this.redis.hget<string>(KEY_MONTH(a), street),
			this.redis.hget<string>(KEY_MONTH(b), street),
		]);
		const merged = emptyPacked();
		for (const v of [x, y])
			if (v) mergePacked(merged, JSON.parse(v) as PackedAggregate);
		return unpack(merged);
	}

	async summary(): Promise<Record<string, ReviewAggregateDto>> {
		const months = recentMonths();
		const hashes = await Promise.all(
			months.map((m) =>
				this.redis.hgetall<Record<string, string>>(KEY_MONTH(m))
			)
		);
		const merged = new Map<string, PackedAggregate>();
		for (const hash of hashes) {
			for (const [street, value] of Object.entries(hash ?? {})) {
				const packed =
					typeof value === "string"
						? (JSON.parse(value) as PackedAggregate)
						: (value as PackedAggregate);
				merged.set(
					street,
					mergePacked(merged.get(street) ?? emptyPacked(), packed)
				);
			}
		}
		return Object.fromEntries(
			[...merged].map(([street, p]) => [street, unpack(p)])
		);
	}

	async claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
		return (
			(await this.redis.set(`rv:claim:${key}`, "1", {
				nx: true,
				ex: ttlSeconds,
			})) === "OK"
		);
	}

	async hit(key: string, windowSeconds: number): Promise<number> {
		const k = `rv:rate:${key}`;
		const [count] = await this.redis
			.pipeline()
			.incr(k)
			.expire(k, windowSeconds, "NX")
			.exec<[number, number]>();
		return count;
	}
}

/**
 * In-memory implementation for local development. Not used in production:
 * serverless instances are ephemeral, so reviews would be silently lost.
 */
export class MemoryReviewStore implements ReviewStore {
	private readonly reviews = new Map<string, ReviewDto[]>();
	private readonly claims = new Map<string, number>();
	private readonly counters = new Map<
		string,
		{ count: number; until: number }
	>();

	async add(review: ReviewDto): Promise<void> {
		const list = this.reviews.get(review.street) ?? [];
		list.unshift(review);
		this.reviews.set(review.street, list.slice(0, LIST_LIMIT));
	}
	async list(street: string, limit: number): Promise<ReviewDto[]> {
		return (this.reviews.get(street) ?? []).slice(0, limit);
	}
	async aggregate(street: string): Promise<ReviewAggregateDto> {
		return unpack(
			(this.reviews.get(street) ?? [])
				.map(packReview)
				.reduce(mergePacked, emptyPacked())
		);
	}
	async summary(): Promise<Record<string, ReviewAggregateDto>> {
		const out: Record<string, ReviewAggregateDto> = {};
		for (const street of this.reviews.keys())
			out[street] = await this.aggregate(street);
		return out;
	}
	async claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
		const now = Date.now();
		if ((this.claims.get(key) ?? 0) > now) return false;
		this.claims.set(key, now + ttlSeconds * 1000);
		return true;
	}
	async hit(key: string, windowSeconds: number): Promise<number> {
		const now = Date.now();
		const c = this.counters.get(key);
		if (!c || c.until < now) {
			this.counters.set(key, {
				count: 1,
				until: now + windowSeconds * 1000,
			});
			return 1;
		}
		return ++c.count;
	}
}
