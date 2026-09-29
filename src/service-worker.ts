/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from "$service-worker";

/**
 * Offline support: the app shell is cached at install. Pages are served
 * network-first (always the current HTML, so it never points at stale
 * assets), falling back to the cached shell offline; the home ignores its
 * query string there, so `/?strada=…` works offline too. Hashed assets and
 * static files are served cache-first. API responses that are safe to reuse (map layer, street details) are served
 * network-first with a cached fallback, keeping only the most recent ones.
 * Location and review calls are never cached.
 */
const sw = self as unknown as ServiceWorkerGlobalScope;
const SHELL = `shell-${version}`;
const DATA = "data-v1";
const CACHEABLE_API = /^\/api\/(map|streets\/|meta)/;
/** Recently viewed streets kept for offline use (plus map and meta). */
const DATA_LIMIT = 40;
/** Images only crawlers and installers need: not worth precaching. */
const SKIP_PRECACHE = /^\/(og-image|icon-|apple-touch-icon)/;

sw.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(SHELL)
			.then((cache) =>
				cache.addAll([
					...build,
					...files.filter((f) => !SKIP_PRECACHE.test(f)),
					"/",
				])
			)
	);
});

sw.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k !== SHELL && k !== DATA)
						.map((k) => caches.delete(k))
				)
			)
	);
});

sw.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(fetch(request).catch(() => offlinePage(url)));
	} else if (CACHEABLE_API.test(url.pathname)) {
		event.respondWith(networkFirst(request));
	} else if (!url.pathname.startsWith("/api/")) {
		event.respondWith(
			caches.match(request).then((hit) => hit ?? fetch(request))
		);
	}
});

async function offlinePage(url: URL): Promise<Response> {
	const hit =
		(await caches.match(url.pathname, { ignoreSearch: true })) ??
		(await caches.match("/"));
	return hit ?? Response.error();
}

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(DATA);
	try {
		const response = await fetch(request);
		if (response.status === 200) {
			await cache.put(request, response.clone());
			void trim(cache);
		}
		return response;
	} catch (error) {
		const hit = await cache.match(request);
		if (hit) return hit;
		throw error;
	}
}

/** Drops the oldest entries (cache keys keep insertion order) beyond the limit. */
async function trim(cache: Cache): Promise<void> {
	const keys = await cache.keys();
	for (let i = 0; i < keys.length - DATA_LIMIT; i++)
		await cache.delete(keys[i]!);
}
