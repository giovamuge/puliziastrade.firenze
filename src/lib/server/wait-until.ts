/**
 * Keeps the serverless function alive until `task` settles, after the
 * response has been sent. Uses the request context that the Vercel runtime
 * exposes on `globalThis` (the same hook `@vercel/functions` reads); outside
 * Vercel the promise simply runs detached.
 */
const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

interface VercelRequestContext {
	get?: () => { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
}

export function waitUntil(task: Promise<unknown>): void {
	const guarded = task.catch((error: unknown) => console.error('[waitUntil] background task failed', error));
	const context = (globalThis as Record<symbol, VercelRequestContext | undefined>)[REQUEST_CONTEXT];
	context?.get?.()?.waitUntil?.(guarded);
}
