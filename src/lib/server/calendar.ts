import type { AlarmOption, CalendarMode } from "$lib/api/contracts";
import { formatMinutes } from "$lib/domain/civil-date";
import type { CityDataset } from "$lib/domain/city-dataset";
import type { RuleGroup } from "$lib/domain/describe";
import {
	icsLocalStamp as localStamp,
	recurrencesFor,
} from "$lib/domain/recurrence";
import { romeLocalToEpochMs, type RomeInstant } from "$lib/domain/rome-clock";
import type { Formatter } from "$lib/i18n";
import { alarmMinutesBefore, alarmWallTime } from "$lib/domain/reminder";
import { IcsCalendarBuilder } from "./ics";

const HORIZON_DAYS = 120;

function utcStamp(epochMs: number): string {
	return new Date(epochMs)
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
}

/** Reminder instant (epoch ms) for a sweep, or null for no reminder. */
export function alarmAt(
	option: AlarmOption,
	day: number,
	from: number
): number | null {
	const wall = alarmWallTime(option, day, from);
	return wall ? romeLocalToEpochMs(wall.day, wall.minute) : null;
}

export interface CalendarRequest {
	street: number;
	/** Restrict to these segments (a schedule group), or null for the whole street. */
	arcs: ReadonlySet<number> | null;
	/** Rules of the same scope, used by the "repeat" mode. */
	rules: readonly RuleGroup[];
	/** Human label of the restriction, e.g. "tra Via A e Via B". */
	scopeLabel: string | null;
	/** Stable id of the restriction for event UIDs. */
	scopeId: string;
	alarm: AlarmOption;
	/** Default "feed". */
	mode?: CalendarMode;
	now: RomeInstant;
	/** Absolute URL of the street page, used in event descriptions. */
	pageUrl: string;
	f: Formatter;
}

export function buildStreetCalendar(
	city: CityDataset,
	request: CalendarRequest
): string {
	const { street, arcs, now, pageUrl, f, alarm } = request;
	const { ics } = f.m;
	const record = city.streets[street]!;
	const title = request.scopeLabel
		? ics.segmentTitle(record.name, request.scopeLabel)
		: record.name;
	const mode = request.mode ?? "feed";
	const builder = new IcsCalendarBuilder(
		ics.calName(title),
		ics.calDesc(title),
		utcStamp(Date.now()),
		mode === "feed"
	);
	const common = {
		summary: ics.summary(title),
		location: ics.location(record.name),
		url: pageUrl,
	};

	if (mode === "repeat") {
		for (const r of recurrencesFor(request.rules, now.day, now.minute)) {
			const minutesBefore = alarmMinutesBefore(alarm, r.from);
			builder.add({
				...common,
				uid: `${record.slug}-${request.scopeId}-${r.rrule.replace(/[^A-Z0-9]/g, "")}-${r.from}-${r.to}@puliziastrade-firenze`,
				start: localStamp(r.day, r.from),
				end: localStamp(r.day, r.end),
				rrule: r.rrule,
				description: [
					f.rule(r.rule),
					ics.noParking,
					ics.details(pageUrl),
				].join("\n"),
				alarmMinutesBefore: minutesBefore ?? undefined,
				alarmText: (minutesBefore !== null && minutesBefore > r.from
					? ics.alarmTomorrow
					: ics.alarmToday)(formatMinutes(r.from), record.name),
			});
		}
		return builder.build();
	}

	for (const o of city.occurrencesForStreet(
		street,
		now.day,
		now.day + HORIZON_DAYS,
		arcs
	)) {
		if (mode === "next" && o.day === now.day && o.end <= now.minute)
			continue;
		const alarmMs = alarmAt(alarm, o.day, o.from);
		const scope =
			o.arcCodes.length === o.totalArcs
				? ics.scopeAll
				: ics.scopeSome(o.arcCodes.length, o.totalArcs);
		const evening =
			alarmMs !== null && alarmMs < romeLocalToEpochMs(o.day, 0);
		builder.add({
			...common,
			uid: `${record.slug}-${request.scopeId}-${localStamp(o.day, o.from)}-${o.to}@puliziastrade-firenze`,
			start: localStamp(o.day, o.from),
			end: localStamp(o.day, o.end),
			description: [
				ics.time(f.timeWindow(o.from, o.to), scope),
				ics.noParking,
				ics.arcCodes(o.arcCodes.join(", ")),
				ics.details(pageUrl),
			].join("\n"),
			alarmAt: alarmMs === null ? undefined : utcStamp(alarmMs),
			alarmText: (evening ? ics.alarmTomorrow : ics.alarmToday)(
				formatMinutes(o.from),
				record.name
			),
		});
		if (mode === "next") break;
	}
	return builder.build();
}
