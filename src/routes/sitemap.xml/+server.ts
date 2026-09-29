import type { RequestHandler } from "./$types";
import { getDatasetService } from "$lib/server/dataset/dataset-service";
import { cacheHeaders } from "$lib/server/http";
import { siteOrigin } from "$lib/server/site-url";
import { streetPath } from "$lib/seo";
import { PRIVACY_UPDATED_AT } from "$lib/site";

const escapeXml = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Sitemap of all crawlable pages: home, A–Z list, one page per street, info and privacy. */
export const GET: RequestHandler = async ({ url }) => {
	const { city } = await getDatasetService().get();
	const origin = siteOrigin(url);
	const source = city.snapshot.source;
	const dataDate = (
		source.resourceModifiedAt ?? source.fileGeneratedAt
	)?.slice(0, 10);

	const entries: [path: string, lastmod: string | undefined][] = [
		["/", dataDate],
		["/strade", dataDate],
		...city.streets.map((s): [string, string | undefined] => [
			streetPath(s.slug),
			dataDate,
		]),
		["/info", dataDate],
		["/privacy", PRIVACY_UPDATED_AT],
	];
	const body =
		'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		entries
			.map(
				([path, lastmod]) =>
					`<url><loc>${escapeXml(origin + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`
			)
			.join("\n") +
		"\n</urlset>\n";
	return new Response(body, {
		headers: {
			"content-type": "application/xml; charset=utf-8",
			...cacheHeaders({
				cdn: 3600,
				staleWhileRevalidate: 86400,
				browser: 3600,
			}),
		},
	});
};
