import type { Handle } from "@sveltejs/kit";
import { DEFAULT_LOCALE } from "$lib/i18n";
import { isPreviewDeployment } from "$lib/server/site-url";

/**
 * - `<html lang>` of server-rendered pages: those rendered in another language set `locals.lang` in their load.
 * - Preview deployments answer with `X-Robots-Tag: noindex`, so only production is indexed.
 * - Security headers on every server response (static files are served by the CDN as is).
 */
/** Sent with every server response (pages and API); the CSP comes from svelte.config.js. */
const SECURITY_HEADERS = {
	"x-content-type-options": "nosniff",
	"x-frame-options": "DENY",
	"referrer-policy": "strict-origin-when-cross-origin",
	"permissions-policy":
		"geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
} as const;

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace("%lang%", event.locals.lang ?? DEFAULT_LOCALE),
	});
	try {
		for (const [name, value] of Object.entries(SECURITY_HEADERS))
			response.headers.set(name, value);
		if (isPreviewDeployment())
			response.headers.set("x-robots-tag", "noindex");
	} catch {
		// Responses with immutable headers (e.g. Response.redirect) keep their own.
	}
	return response;
};
