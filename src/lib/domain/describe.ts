import type { Weekday } from './civil-date';
import type { WeekKind } from './schedule';

/** A single recurrence rule in structured form. */
export interface RuleLike {
	weekday: Weekday;
	kind: WeekKind;
	from: number;
	to: number;
}

/** Rules sharing weekday and time window, merged: e.g. 1st and 3rd Tuesday 00:00–06:00. */
export interface RuleGroup {
	weekday: Weekday;
	kinds: WeekKind[];
	from: number;
	to: number;
}

/** Groups rules by (weekday, window); sorted by weekday then start time. Wording is left to i18n. */
export function groupRules(rules: readonly RuleLike[]): RuleGroup[] {
	const groups = new Map<string, RuleGroup>();
	for (const r of rules) {
		const key = `${r.weekday}|${r.from}|${r.to}`;
		const group = groups.get(key);
		if (group) {
			if (!group.kinds.includes(r.kind)) group.kinds.push(r.kind);
		} else groups.set(key, { weekday: r.weekday, kinds: [r.kind], from: r.from, to: r.to });
	}
	return [...groups.values()]
		.map((g) => ({ ...g, kinds: g.kinds.sort((a, b) => a - b) }))
		.sort((a, b) => a.weekday - b.weekday || a.from - b.from);
}

/** Time-of-day band used by the map "day" view. */
export const TimeBand = { Night: 0, Morning: 1, Afternoon: 2 } as const;
export type TimeBand = (typeof TimeBand)[keyof typeof TimeBand];

export function timeBandOf(fromMinute: number): TimeBand {
	if (fromMinute < 6 * 60) return TimeBand.Night;
	if (fromMinute < 12 * 60) return TimeBand.Morning;
	return TimeBand.Afternoon;
}
