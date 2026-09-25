/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

/**
 * Offline support: the app shell is cached at install; API responses that are
 * safe to reuse (map layer, street details) are served network-first with a
 * cached fallback. Location and review calls are never cached.
 */
const sw = self as unknown as ServiceWorkerGlobalScope;
const SHELL = `shell-${version}`;
const DATA = 'data-v1';
const CACHEABLE_API = /^\/api\/(map|streets\/|meta)/;
/** Images only crawlers and installers need: not worth precaching. */
const SKIP_PRECACHE = /^\/(og-image|icon-|apple-touch-icon)/;

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll([...build, ...files.filter((f) => !SKIP_PRECACHE.test(f)), '/'])));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	if (CACHEABLE_API.test(url.pathname)) {
		event.respondWith(networkFirst(request));
	} else if (!url.pathname.startsWith('/api/')) {
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).catch(() => caches.match('/') as Promise<Response>)));
	}
});

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(DATA);
	try {
		const response = await fetch(request);
		if (response.ok) await cache.put(request, response.clone());
		return response;
	} catch (error) {
		const hit = await cache.match(request);
		if (hit) return hit;
		throw error;
	}
}
