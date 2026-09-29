import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

/**
 * Public origin used in canonical URLs, Open Graph tags and the sitemap.
 * `PUBLIC_SITE_URL` wins (custom domain); on Vercel the production domain is
 * used otherwise, so previews and prerendering never emit their own host.
 */
export function siteOrigin(requestUrl: URL): string {
	const configured =
		publicEnv.PUBLIC_SITE_URL ||
		(privateEnv.VERCEL_PROJECT_PRODUCTION_URL &&
			`https://${privateEnv.VERCEL_PROJECT_PRODUCTION_URL}`);
	return (configured || requestUrl.origin).replace(/\/+$/, "");
}

/** Vercel preview deployments must stay out of search indexes (duplicate content). */
export function isPreviewDeployment(): boolean {
	return privateEnv.VERCEL_ENV === "preview";
}
