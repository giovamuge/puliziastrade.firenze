import { civilFromDays, pad2, packedDay, packedMonth, packedYear, weekdayOf } from './civil-date';
import { kindMatchesDay, WeekKind } from './schedule';

/**
 * RFC 5545 recurrences for the sweeping rules, shared by the ICS generator
 * and the "add to Google Calendar" link so both describe the same events.
 *
 * Mapping (the n-th weekday of the month is exactly days 1–7, 8–14, …, 29–31):
 * - every week        → FREQ=WEEKLY;BYDAY=TU
 * - 1st/3rd week      → FREQ=MONTHLY;BYDAY=1TU,3TU
 * - odd/even days     → FREQ=MONTHLY;BYDAY=TU;BYMONTHDAY=1,3,…,31
 */

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
const ODD_DAYS = Array.from({ length: 16 }, (_, i) => 2 * i + 1).join(',');
const EVEN_DAYS = Array.from({ length: 15 }, (_, i) => 2 * i + 2).join(',');
/** A "quinta settimana" can be ~3 months away; one year is a safe upper bound. */
const MAX_LOOKAHEAD_DAYS = 400;

/** Structural rule shape shared by the domain `RuleGroup` and the API `RuleDto`. */
export interface RecurringRule {
	weekday: number;
	kinds: number[];
	from: number;
	to: number;
}

export interface Recurrence {
	/** The rule this event comes from (a rule mixing week kinds may yield several events). */
	rule: RecurringRule;
	/** RRULE value, without the `RRULE:` prefix. */
	rrule: string;
	/** First day (≥ today, window not yet ended) matching the rule: the event's DTSTART. */
	day: number;
	from: number;
	to: number;
	/** Effective end minute (empty source windows last 30 minutes). */
	end: number;
}

/** Splits a rule into parts that a single RRULE can express, each with the kinds it covers. */
function patterns(rule: RecurringRule): { rrule: string; kinds: WeekKind[] }[] {
	const day = BYDAY[rule.weekday]!;
	const odd = rule.kinds.includes(WeekKind.OddDays);
	const even = rule.kinds.includes(WeekKind.EvenDays);
	if (rule.kinds.includes(WeekKind.Every) || (odd && even)) return [{ rrule: `FREQ=WEEKLY;BYDAY=${day}`, kinds: [WeekKind.Every] }];
	const parts: { rrule: string; kinds: WeekKind[] }[] = [];
	const nth = rule.kinds.filter((k): k is WeekKind => k >= WeekKind.Nth1 && k <= WeekKind.Nth5).sort((a, b) => a - b);
	if (nth.length) parts.push({ rrule: `FREQ=MONTHLY;BYDAY=${nth.map((n) => `${n}${day}`).join(',')}`, kinds: nth });
	if (odd) parts.push({ rrule: `FREQ=MONTHLY;BYDAY=${day};BYMONTHDAY=${ODD_DAYS}`, kinds: [WeekKind.OddDays] });
	if (even) parts.push({ rrule: `FREQ=MONTHLY;BYDAY=${day};BYMONTHDAY=${EVEN_DAYS}`, kinds: [WeekKind.EvenDays] });
	return parts;
}

/** Recurring events for `rules`, anchored on their first sweep that has not ended at (`today`, `minute`). */
export function recurrencesFor(rules: readonly RecurringRule[], today: number, minute: number): Recurrence[] {
	const result: Recurrence[] = [];
	for (const rule of rules) {
		const end = rule.to > rule.from ? rule.to : rule.from + 30;
		for (const { rrule, kinds } of patterns(rule)) {
			let day = today + ((rule.weekday - weekdayOf(today) + 7) % 7);
			if (day === today && end <= minute) day += 7;
			while (day - today <= MAX_LOOKAHEAD_DAYS && !kinds.some((k) => kindMatchesDay(k, day))) day += 7;
			if (day - today <= MAX_LOOKAHEAD_DAYS) result.push({ rule, rrule, day, from: rule.from, to: rule.to, end });
		}
	}
	return result.sort((a, b) => a.day - b.day || a.from - b.from);
}

/** Europe/Rome wall time as `YYYYMMDDTHHMMSS`; minutes past midnight (e.g. 24:00) roll into the next day. */
export function icsLocalStamp(day: number, minute: number): string {
	const d = day + Math.floor(minute / 1440);
	const m = minute % 1440;
	const p = civilFromDays(d);
	return `${packedYear(p)}${pad2(packedMonth(p))}${pad2(packedDay(p))}T${pad2(Math.floor(m / 60))}${pad2(m % 60)}00`;
}
