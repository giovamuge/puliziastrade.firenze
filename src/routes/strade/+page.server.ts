import type { PageServerLoad } from './$types';
import { DEFAULT_LOCALE } from '$lib/i18n';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { cacheHeaders } from '$lib/server/http';
import { siteOrigin } from '$lib/server/site-url';
import { groupStreetsByLetter } from '$lib/server/street-index';

/** Crawlable A–Z list of streets. Rendered in Italian (cacheable on the CDN); the client switches language after hydration. */
export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const { city } = await getDatasetService().get();
	setHeaders(cacheHeaders({ cdn: 3600, staleWhileRevalidate: 86400, browser: 300 }));
	return { locale: DEFAULT_LOCALE, origin: siteOrigin(url), count: city.streets.length, letters: groupStreetsByLetter(city.streets) };
};
