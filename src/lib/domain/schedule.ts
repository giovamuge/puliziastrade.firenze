import { dayOfMonth, weekdayOf, type Weekday } from './civil-date';

/**
 * Recurrence patterns used by Alia for street sweeping in Florence.
 *
 * Semantics (as printed on the street signs):
 * - "prima … quinta settimana": the n-th occurrence of the weekday in the
 *   month (e.g. "prima settimana, martedì" = first Tuesday, day 1–7).
 * - "settimane dispari/pari": the weekday, only when it falls on an odd/even
 *   day of the month (e.g. Tuesday the 11th yes, Tuesday the 18th no).
 * - "tutte le settimane": every week.
 */
export const WeekKind = {
	Every: 0,
	Nth1: 1,
	Nth2: 2,
	Nth3: 3,
	Nth4: 4,
	Nth5: 5,
	OddDays: 6,
	EvenDays: 7
} as const;
export type WeekKind = (typeof WeekKind)[keyof typeof WeekKind];

/** Strategy table: one predicate per recurrence kind, indexed by `WeekKind`. */
const KIND_MATCHES_DAY_OF_MONTH: ReadonlyArray<(dom: number) => boolean> = [
	() => true,
	(dom) => dom <= 7,
	(dom) => dom >= 8 && dom <= 14,
	(dom) => dom >= 15 && dom <= 21,
	(dom) => dom >= 22 && dom <= 28,
	(dom) => dom >= 29,
	(dom) => (dom & 1) === 1,
	(dom) => (dom & 1) === 0
];

/**
 * Rules are stored flat in a numeric array, four slots each, so that a whole
 * city of schedules lives in one contiguous buffer.
 */
export const RULE_STRIDE = 4;
export const RULE_WEEKDAY = 0;
export const RULE_KIND = 1;
export const RULE_FROM = 2;
export const RULE_TO = 3;

export type RuleBuffer = ArrayLike<number>;

export function ruleWeekday(rules: RuleBuffer, rule: number): Weekday {
	return rules[rule * RULE_STRIDE + RULE_WEEKDAY] as Weekday;
}
export function ruleKind(rules: RuleBuffer, rule: number): WeekKind {
	return rules[rule * RULE_STRIDE + RULE_KIND] as WeekKind;
}
export function ruleFrom(rules: RuleBuffer, rule: number): number {
	return rules[rule * RULE_STRIDE + RULE_FROM] as number;
}
/** End minute; when the source gives an empty window (e.g. 13:30–13:30) it equals `from`. */
export function ruleTo(rules: RuleBuffer, rule: number): number {
	return rules[rule * RULE_STRIDE + RULE_TO] as number;
}

export function kindMatchesDay(kind: WeekKind, day: number): boolean {
	return KIND_MATCHES_DAY_OF_MONTH[kind]!(dayOfMonth(day));
}

export function ruleMatchesDay(rules: RuleBuffer, rule: number, day: number): boolean {
	return weekdayOf(day) === ruleWeekday(rules, rule) && kindMatchesDay(ruleKind(rules, rule), day);
}

/** A "quinta settimana" can be ~3 months away; one year is a safe upper bound. */
const MAX_LOOKAHEAD_DAYS = 400;

/**
 * First day ≥ `fromDay` on which `rule` applies, or -1 if none within a year.
 * Walks week by week on the right weekday: at most ~57 iterations, no allocation.
 */
export function nextRuleDay(rules: RuleBuffer, rule: number, fromDay: number): number {
	const weekday = ruleWeekday(rules, rule);
	const kind = ruleKind(rules, rule);
	const delta = (weekday - weekdayOf(fromDay) + 7) % 7;
	for (let day = fromDay + delta; day - fromDay <= MAX_LOOKAHEAD_DAYS; day += 7) {
		if (kindMatchesDay(kind, day)) return day;
	}
	return -1;
}

/**
 * Effective end minute of a rule window. Empty windows (source quirk) are
 * treated as lasting 30 minutes so they don't vanish from "today".
 */
export function ruleEffectiveEnd(rules: RuleBuffer, rule: number): number {
	const from = ruleFrom(rules, rule);
	const to = ruleTo(rules, rule);
	return to > from ? to : from + 30;
}

/**
 * Next day on which `rule` is still relevant at (`today`, `minute`):
 * today if today's window has not ended yet, otherwise the next occurrence.
 */
export function nextRelevantDay(rules: RuleBuffer, rule: number, today: number, minute: number): number {
	if (ruleMatchesDay(rules, rule, today) && minute < ruleEffectiveEnd(rules, rule)) return today;
	return nextRuleDay(rules, rule, today + 1);
}
