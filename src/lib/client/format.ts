import type { CleaningWindowDto } from "$lib/api/contracts";
import { formatMinutes, parseIsoDate } from "$lib/domain/civil-date";
import type { RomeInstant } from "$lib/domain/rome-clock";
import type { Formatter } from "$lib/i18n";

export type Tone = "now" | "today" | "tomorrow" | "week" | "later" | "none";

export interface WindowStatus {
	tone: Tone;
	/** Short badge text: "In corso", "Oggi", "Stanotte", "Tra 5 giorni". */
	badge: string;
	/** Main sentence. */
	headline: string;
	/** Practical advice. */
	advice: string;
	daysAhead: number;
}

const NIGHT_END = 6 * 60;

/** Relative, human status of a cleaning window, computed from the client clock in the user's language. */
export function windowStatus(
	window: CleaningWindowDto | null,
	now: RomeInstant,
	f: Formatter
): WindowStatus {
	const s = f.m.status;
	if (!window)
		return {
			tone: "none",
			badge: s.noneBadge,
			headline: s.noneHeadline,
			advice: s.noneAdvice,
			daysAhead: -1,
		};

	const day = parseIsoDate(window.date);
	const daysAhead = day - now.day;
	const time = f.timeWindow(window.from, window.to);
	const start = formatMinutes(window.from);

	if (daysAhead <= 0) {
		if (now.minute >= window.from) {
			return {
				tone: "now",
				badge: s.nowBadge,
				headline: s.nowHeadline(formatMinutes(window.end)),
				advice: s.nowAdvice,
				daysAhead: 0,
			};
		}
		return {
			tone: "today",
			badge: s.todayBadge,
			headline: s.todayHeadline(time),
			advice: s.moveBefore(start),
			daysAhead: 0,
		};
	}
	if (daysAhead === 1) {
		if (window.from < NIGHT_END) {
			return {
				tone: "tomorrow",
				badge: s.tonightBadge,
				headline: s.tonightHeadline(time),
				advice: s.tonightAdvice(
					f.weekdayOfDay(now.day),
					f.weekdayOfDay(day)
				),
				daysAhead,
			};
		}
		return {
			tone: "tomorrow",
			badge: s.tomorrowBadge,
			headline: s.tomorrowHeadline(time),
			advice: s.moveBeforeTomorrow(start),
			daysAhead,
		};
	}
	return {
		tone: daysAhead <= 7 ? "week" : "later",
		badge: s.inDaysBadge(daysAhead),
		headline: `${f.longDate(day, true)}, ${time}`,
		advice: s.laterAdvice,
		daysAhead,
	};
}

/** Short relative day: "oggi", "domani", "tra 5 gg". */
export function relativeDay(day: number, today: number, f: Formatter): string {
	const d = day - today;
	return d <= 0
		? f.m.street.today
		: d === 1
			? f.m.street.tomorrow
			: f.m.street.inDaysShort(d);
}

/** Tailwind classes per tone (declared statically so the compiler keeps them). */
export const TONE_CLASSES: Record<Tone, string> = {
	now: "bg-tone-now text-tone-now-fg",
	today: "bg-tone-today text-tone-today-fg",
	tomorrow: "bg-tone-tomorrow text-tone-tomorrow-fg",
	week: "bg-tone-week text-tone-week-fg",
	later: "bg-tone-later text-tone-later-fg",
	none: "bg-tone-later text-tone-later-fg",
};
