import type { Handle } from '@sveltejs/kit';
import { DEFAULT_LOCALE } from '$lib/i18n';
import { isPreviewDeployment } from '$lib/server/site-url';

/**
 * - `<html lang>` of server-rendered pages: those rendered in another language set `locals.lang` in their load.
 * - Preview deployments answer with `X-Robots-Tag: noindex`, so only production is indexed.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, { transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.lang ?? DEFAULT_LOCALE) });
	if (isPreviewDeployment()) response.headers.set('x-robots-tag', 'noindex');
	return response;
};
