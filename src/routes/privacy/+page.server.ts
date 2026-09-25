import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/public';
import { siteOrigin } from '$lib/server/site-url';
import { isLocale, matchLocale, parseAcceptLanguage } from '$lib/i18n';

export const load: PageServerLoad = async ({ cookies, request, setHeaders, locals, url }) => {
	const stored = cookies.get('locale');
	const locale = isLocale(stored) ? stored : matchLocale(parseAcceptLanguage(request.headers.get('accept-language')));
	locals.lang = locale;
	setHeaders({ 'cache-control': 'private, max-age=3600' });
	return {
		locale,
		origin: siteOrigin(url),
		// Configured per deployment (Vercel env vars), never hard-coded.
		owner: env.PUBLIC_OWNER_NAME && env.PUBLIC_OWNER_EMAIL ? { name: env.PUBLIC_OWNER_NAME, email: env.PUBLIC_OWNER_EMAIL } : null
	};
};
