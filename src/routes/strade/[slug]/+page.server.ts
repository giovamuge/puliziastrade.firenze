import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { NearestResult } from '$lib/domain/spatial-index';
import { DEFAULT_LOCALE } from '$lib/i18n';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { cacheHeaders, romeNow, secondsUntilRomeMidnight } from '$lib/server/http';
import { presentStreetDetail } from '$lib/server/presenters';
import { siteOrigin } from '$lib/server/site-url';

const UPCOMING_SHOWN = 12;
const NEARBY_RADIUS = 400;
/** Reused across requests; one extra slot because the street itself is always nearest. */
const nearby = new NearestResult(9);

/**
 * Crawlable schedule page of one street. Rendered in Italian so it can be
 * shared by the CDN; the client switches language after hydration. Only the
 * fields shown are sent (the full DTO stays behind `/api/streets/:slug`).
 */
export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
	const services = await getDatasetService().get();
	const street = services.city.streetBySlug(params.slug);
	if (street < 0) error(404, 'Strada non trovata');

	const now = romeNow();
	const detail = presentStreetDetail(services, street, now);
	const [west, south, east, north] = detail.bbox;
	const center = { lon: (west + east) / 2, lat: (south + north) / 2 };

	services.spatial.nearestStreets(center.lon, center.lat, NEARBY_RADIUS, nearby);
	const neighbours: { slug: string; name: string }[] = [];
	for (let i = 0; i < nearby.size; i++) {
		const other = nearby.streets[i]!;
		if (other !== street) neighbours.push({ slug: services.city.streets[other]!.slug, name: services.city.streets[other]!.name });
	}

	// Upcoming sweeps are dated absolutely, so a copy cached until midnight is still correct.
	setHeaders(cacheHeaders({ cdn: Math.min(3600, secondsUntilRomeMidnight(now)), staleWhileRevalidate: 3600, browser: 300 }));
	return {
		locale: DEFAULT_LOCALE,
		origin: siteOrigin(url),
		street: {
			slug: detail.slug,
			name: detail.name,
			rules: detail.rules,
			sectionCount: detail.sectionCount,
			groups: detail.groups.map((g) => ({ between: g.between, rules: g.rules, segmentCount: g.segments.length, lengthMeters: g.lengthMeters })),
			upcoming: detail.upcoming.slice(0, UPCOMING_SHOWN).map((o) => ({ date: o.date, from: o.from, to: o.to, groups: o.groups, wholeStreet: o.wholeStreet })),
			center,
			dataUpdatedAt: detail.dataUpdatedAt
		},
		neighbours
	};
};
