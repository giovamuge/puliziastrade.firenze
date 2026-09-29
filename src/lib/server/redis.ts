import { Redis } from "@upstash/redis";
import { env } from "$env/dynamic/private";

let client: Redis | null | undefined;

/**
 * Upstash Redis (REST, works in serverless). Accepts both the variable names
 * injected by the Vercel Marketplace integration and Upstash's own.
 * Returns `null` when not configured: callers must degrade gracefully.
 */
export function getRedis(): Redis | null {
	if (client !== undefined) return client;
	const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
	const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
	client =
		url && token
			? new Redis({ url, token, automaticDeserialization: false })
			: null;
	return client;
}
