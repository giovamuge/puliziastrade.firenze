import type { PageServerLoad } from './$types';
import { siteOrigin } from '$lib/server/site-url';
import { isLocale, matchLocale, parseAcceptLanguage } from '$lib/i18n';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { getReviewService } from '$lib/server/reviews/review-service';
import { presentMeta } from '$lib/server/presenters';
import { romeNow } from '$lib/server/http';

export const load: PageServerLoad = async ({ setHeaders, cookies, request, locals, url }) => {
	const services = await getDatasetService().get();
	const stored = cookies.get('locale');
	const locale = isLocale(stored) ? stored : matchLocale(parseAcceptLanguage(request.headers.get('accept-language')));
	locals.lang = locale;
	// Content varies by language: keep it out of shared caches.
	setHeaders({ 'cache-control': 'private, max-age=300' });
	return { locale, origin: siteOrigin(url), meta: presentMeta(services, romeNow(), getReviewService().enabled) };
};
