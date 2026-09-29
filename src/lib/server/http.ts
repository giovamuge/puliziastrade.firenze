import { json } from "@sveltejs/kit";
import { readRomeInstant, type RomeInstant } from "$lib/domain/rome-clock";
import type { ApiErrorCode, ApiErrorDto } from "$lib/api/contracts";
import { it } from "$lib/i18n/it";

export interface CachePolicy {
	/** Seconds the Vercel CDN may serve the response as fresh. */
	cdn: number;
	/** Extra seconds the CDN may serve stale content while revalidating in background. */
	staleWhileRevalidate?: number;
	/** Browser max-age. */
	browser?: number;
}

/**
 * Cache headers: `Cache-Control` for browsers, `CDN-Cache-Control` for the
 * Vercel edge. With SWR, the first request after expiry receives the cached
 * copy instantly and triggers one background regeneration.
 */
export function cacheHeaders(policy: CachePolicy): Record<string, string> {
	const swr = policy.staleWhileRevalidate ?? 0;
	return {
		"cache-control": `public, max-age=${policy.browser ?? 0}, must-revalidate`,
		"cdn-cache-control": `public, s-maxage=${policy.cdn}${swr ? `, stale-while-revalidate=${swr}` : ""}, stale-if-error=86400`,
	};
}

export const NO_STORE = { "cache-control": "private, no-store" } as const;

export function jsonCached<T>(
	body: T,
	policy: CachePolicy,
	init?: ResponseInit
): Response {
	return json(body, {
		...init,
		headers: {
			...cacheHeaders(policy),
			...(init?.headers as Record<string, string>),
		},
	});
}

export function apiError(status: number, code: ApiErrorCode): Response {
	return json({ code, message: it.errors[code] } satisfies ApiErrorDto, {
		status,
		headers: NO_STORE,
	});
}

export function romeNow(): RomeInstant {
	return readRomeInstant(Date.now());
}

/** Seconds until the next Europe/Rome midnight (min 60 s). */
export function secondsUntilRomeMidnight(now: RomeInstant = romeNow()): number {
	return Math.max(60, (24 * 60 - now.minute) * 60);
}
