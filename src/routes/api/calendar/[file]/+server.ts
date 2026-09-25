import type { RequestHandler } from './$types';
import { ALARM_OPTIONS, type AlarmOption } from '$lib/api/contracts';
import { formatterFor, isLocale, matchLocale, parseAcceptLanguage } from '$lib/i18n';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { buildStreetCalendar } from '$lib/server/calendar';
import { apiError, cacheHeaders, romeNow } from '$lib/server/http';

/**
 * `GET /api/calendar/<slug>.ics[?tratto=<cod_arco>][&avviso=auto|evening|120|60|none][&lang=it|en|…]`
 *
 * Subscribable iCalendar feed. `tratto` restricts the feed to the schedule
 * group containing that segment (the contiguous run with the same rules).
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
	const slug = params.file.replace(/\.ics$/i, '');
	const services = await getDatasetService().get();
	const { city, topology } = services;
	const street = city.streetBySlug(slug);
	if (street < 0) return apiError(404, 'not_found');

	const lang = url.searchParams.get('lang');
	const f = formatterFor(isLocale(lang) ? lang : matchLocale(parseAcceptLanguage(request.headers.get('accept-language'))));
	const alarmParam = url.searchParams.get('avviso');
	const alarm: AlarmOption = (ALARM_OPTIONS as readonly string[]).includes(alarmParam ?? '') ? (alarmParam as AlarmOption) : 'auto';

	const segment = url.searchParams.get('tratto');
	let arcs: Set<number> | null = null;
	let scopeLabel: string | null = null;
	if (segment) {
		const arc = city.arcByCode(segment);
		if (arc < 0 || city.arcStreet[arc] !== street) return apiError(404, 'segment_not_found');
		const layout = topology.layout(street);
		const groupIndex = layout.arcGroup.get(arc)!;
		const group = layout.groups[groupIndex]!;
		arcs = new Set(group.arcs);
		scopeLabel = f.between(group.between, groupIndex);
	}

	const page = new URL('/', url.origin);
	page.searchParams.set('strada', slug);
	if (segment) page.searchParams.set('tratto', segment);
	const body = buildStreetCalendar(city, {
		street,
		arcs,
		scopeLabel,
		scopeId: segment ?? 'all',
		alarm,
		now: romeNow(),
		pageUrl: page.href,
		f
	});
	return new Response(body, {
		headers: {
			...cacheHeaders({ cdn: 6 * 3600, staleWhileRevalidate: 86400, browser: 3600 }),
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `inline; filename="pulizia-${slug}${segment ? `-${segment}` : ''}.ics"`,
			vary: 'accept-language'
		}
	});
};
