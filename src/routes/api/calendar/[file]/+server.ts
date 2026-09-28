import type { RequestHandler } from './$types';
import { ALARM_OPTIONS, CALENDAR_MODES, type AlarmOption, type CalendarMode } from '$lib/api/contracts';
import { groupRules } from '$lib/domain/describe';
import { formatterFor, isLocale, matchLocale, parseAcceptLanguage } from '$lib/i18n';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { buildStreetCalendar } from '$lib/server/calendar';
import { apiError, cacheHeaders, romeNow } from '$lib/server/http';

/**
 * `GET /api/calendar/<slug>.ics[?tratto=<cod_arco>][&avviso=auto|evening|120|60|none][&lang=it|en|…][&modo=feed|next|repeat]`
 *
 * Subscribable iCalendar feed. `tratto` restricts the feed to the schedule
 * group containing that segment (the contiguous run with the same rules).
 * `modo=next` returns only the next sweep as a one-off event to import;
 * `modo=repeat` one recurring event (RRULE) per rule. Both depend on the
 * current time, so they are cached briefly; the feed (default) for hours.
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

	const modeParam = url.searchParams.get('modo');
	const mode: CalendarMode = (CALENDAR_MODES as readonly string[]).includes(modeParam ?? '') ? (modeParam as CalendarMode) : 'feed';
	const segment = url.searchParams.get('tratto');
	let arcs: Set<number> | null = null;
	let scopeLabel: string | null = null;
	let ruleIds: ArrayLike<number> = city.streetRules.subarray(city.streetRuleOffsets[street]!, city.streetRuleOffsets[street + 1]!);
	if (segment) {
		const arc = city.arcByCode(segment);
		if (arc < 0 || city.arcStreet[arc] !== street) return apiError(404, 'segment_not_found');
		const layout = topology.layout(street);
		const groupIndex = layout.arcGroup.get(arc)!;
		const group = layout.groups[groupIndex]!;
		arcs = new Set(group.arcs);
		ruleIds = group.rules;
		scopeLabel = f.between(group.between, groupIndex);
	}

	const page = new URL('/', url.origin);
	page.searchParams.set('strada', slug);
	if (segment) page.searchParams.set('tratto', segment);
	const body = buildStreetCalendar(city, {
		street,
		arcs,
		rules: groupRules(Array.from(ruleIds, (r) => city.ruleLike(r))),
		scopeLabel,
		scopeId: segment ?? 'all',
		alarm,
		mode,
		now: romeNow(),
		pageUrl: page.href,
		f
	});
	return new Response(body, {
		headers: {
			...cacheHeaders(mode === 'feed' ? { cdn: 6 * 3600, staleWhileRevalidate: 86400, browser: 3600 } : { cdn: 300, staleWhileRevalidate: 600, browser: 0 }),
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `inline; filename="pulizia-${slug}${segment ? `-${segment}` : ''}${mode === 'feed' ? '' : `-${mode}`}.ics"`,
			vary: 'accept-language'
		}
	});
};
