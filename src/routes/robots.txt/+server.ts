import type { RequestHandler } from './$types';
import { cacheHeaders } from '$lib/server/http';
import { isPreviewDeployment, siteOrigin } from '$lib/server/site-url';

/** Dynamic so the sitemap URL is absolute on every deployment; previews are kept out of indexes. */
export const GET: RequestHandler = ({ url }) => {
	const body = isPreviewDeployment()
		? 'User-agent: *\nDisallow: /\n'
		: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteOrigin(url)}/sitemap.xml\n`;
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', ...cacheHeaders({ cdn: 86400, browser: 3600 }) } });
};
