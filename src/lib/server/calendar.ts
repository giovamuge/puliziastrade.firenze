import type { AlarmOption } from '$lib/api/contracts';
import { civilFromDays, formatMinutes, pad2, packedDay, packedMonth, packedYear } from '$lib/domain/civil-date';
import type { CityDataset } from '$lib/domain/city-dataset';
import { romeLocalToEpochMs, type RomeInstant } from '$lib/domain/rome-clock';
import type { Formatter } from '$lib/i18n';
import { alarmWallTime } from '$lib/domain/reminder';
import { IcsCalendarBuilder } from './ics';

const HORIZON_DAYS = 120;
function localStamp(day: number, minute: number): string {
	// Minutes may overflow past midnight (e.g. 24:00): normalise into the next day.
	const d = day + Math.floor(minute / 1440);
	const m = minute % 1440;
	const p = civilFromDays(d);
	return `${packedYear(p)}${pad2(packedMonth(p))}${pad2(packedDay(p))}T${pad2(Math.floor(m / 60))}${pad2(m % 60)}00`;
}

function utcStamp(epochMs: number): string {
	return new Date(epochMs).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Reminder instant (epoch ms) for a sweep, or null for no reminder. */
export function alarmAt(option: AlarmOption, day: number, from: number): number | null {
	const wall = alarmWallTime(option, day, from);
	return wall ? romeLocalToEpochMs(wall.day, wall.minute) : null;
}

export interface CalendarRequest {
	street: number;
	/** Restrict to these segments (a schedule group), or null for the whole street. */
	arcs: ReadonlySet<number> | null;
	/** Human label of the restriction, e.g. "tra Via A e Via B". */
	scopeLabel: string | null;
	/** Stable id of the restriction for event UIDs. */
	scopeId: string;
	alarm: AlarmOption;
	now: RomeInstant;
	/** Absolute URL of the street page, used in event descriptions. */
	pageUrl: string;
	f: Formatter;
}

export function buildStreetCalendar(city: CityDataset, request: CalendarRequest): string {
	const { street, arcs, now, pageUrl, f, alarm } = request;
	const { ics } = f.m;
	const record = city.streets[street]!;
	const title = request.scopeLabel ? ics.segmentTitle(record.name, request.scopeLabel) : record.name;
	const builder = new IcsCalendarBuilder(ics.calName(title), ics.calDesc(title), utcStamp(Date.now()));

	for (const o of city.occurrencesForStreet(street, now.day, now.day + HORIZON_DAYS, arcs)) {
		const alarmMs = alarmAt(alarm, o.day, o.from);
		const scope = o.arcCodes.length === o.totalArcs ? ics.scopeAll : ics.scopeSome(o.arcCodes.length, o.totalArcs);
		const evening = alarmMs !== null && alarmMs < romeLocalToEpochMs(o.day, 0);
		builder.add({
			uid: `${record.slug}-${request.scopeId}-${localStamp(o.day, o.from)}-${o.to}@puliziastrade-firenze`,
			start: localStamp(o.day, o.from),
			end: localStamp(o.day, o.end),
			summary: ics.summary(title),
			description: [
				ics.time(f.timeWindow(o.from, o.to), scope),
				ics.noParking,
				ics.arcCodes(o.arcCodes.join(', ')),
				ics.details(pageUrl)
			].join('\n'),
			location: ics.location(record.name),
			url: pageUrl,
			alarmAt: alarmMs === null ? undefined : utcStamp(alarmMs),
			alarmText: (evening ? ics.alarmTomorrow : ics.alarmToday)(formatMinutes(o.from), record.name)
		});
	}
	return builder.build();
}
