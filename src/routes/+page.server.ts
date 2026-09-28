import type { PageServerLoad } from './$types';
import { cacheHeaders } from '$lib/server/http';
import { siteOrigin } from '$lib/server/site-url';

/**
 * The shell is static and all data comes from the API. It is rendered on the server
 * (not prerendered) so it gets the CSP and security headers, which static files skip;
 * the CDN keeps it for a day, so it is served as fast as a static page.
 */
export const load: PageServerLoad = ({ url, setHeaders }) => {
	setHeaders(cacheHeaders({ cdn: 86400, staleWhileRevalidate: 7 * 86400 }));
	return { origin: siteOrigin(url) };
};
