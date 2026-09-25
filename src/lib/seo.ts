/** Isomorphic SEO helpers: page paths and schema.org JSON-LD builders. */

export const SITE_NAME = 'Strade Pulite Firenze';
export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630 } as const;

export const streetPath = (slug: string): string => `/strade/${encodeURIComponent(slug)}`;
export const mapPath = (slug: string): string => `/?strada=${encodeURIComponent(slug)}`;

export type JsonLd = Record<string, unknown>;

/** Serialises JSON-LD for an inline `<script>`: `<` is escaped so data can never close the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
	const graph = Array.isArray(data) ? { '@context': 'https://schema.org', '@graph': data } : { '@context': 'https://schema.org', ...data };
	return JSON.stringify(graph).replace(/</g, '\\u003c');
}

export function breadcrumbLd(origin: string, items: readonly (readonly [name: string, path: string])[]): JsonLd {
	return {
		'@type': 'BreadcrumbList',
		itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: origin + path }))
	};
}

/** Description trimmed on a word boundary to the ~160 characters shown in results. */
export function clampDescription(text: string, max = 160): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max - 1);
	return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.]+$/, '')}…`;
}
