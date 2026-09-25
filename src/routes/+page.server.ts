import type { PageServerLoad } from './$types';
import { siteOrigin } from '$lib/server/site-url';

// The shell is static and served from the CDN; all data comes from the API.
export const prerender = true;

export const load: PageServerLoad = ({ url }) => ({ origin: siteOrigin(url) });
