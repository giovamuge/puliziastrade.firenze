import { timeBandOf } from "./describe";
import {
	RULE_STRIDE,
	nextRelevantDay,
	ruleEffectiveEnd,
	ruleFrom,
	ruleMatchesDay,
	type RuleBuffer,
} from "./schedule";

/**
 * Map state of a segment. Lower wins when a segment has several rules, so a
 * sweep already done today outranks "tomorrow" or "later": people checking in
 * the afternoon still see that the street was cleaned this morning.
 */
export const Urgency = {
	Now: 0,
	Today: 1,
	DoneToday: 2,
	Tomorrow: 3,
	ThisWeek: 4,
	Later: 5,
	None: 6,
} as const;
export type Urgency = (typeof Urgency)[keyof typeof Urgency];

export function urgencyOf(daysAhead: number, isActiveNow: boolean): Urgency {
	if (daysAhead < 0) return Urgency.None;
	if (daysAhead === 0) return isActiveNow ? Urgency.Now : Urgency.Today;
	if (daysAhead === 1) return Urgency.Tomorrow;
	if (daysAhead <= 7) return Urgency.ThisWeek;
	return Urgency.Later;
}

/** Sentinel for "no rule matches on the selected day". */
export const NO_BAND = 255;

/**
 * Batch computations for the map layer. Arrays are allocated once and reused
 * on each refresh (clock tick / mode change): the per-refresh cost is a pair
 * of linear scans with zero allocations.
 */
export class UrgencyCalculator {
	private readonly ruleUrgency: Uint8Array;
	private readonly ruleBand: Uint8Array;
	readonly arcValue: Uint8Array;

	constructor(
		private readonly rules: RuleBuffer,
		private readonly arcRuleOffsets: ArrayLike<number>,
		private readonly arcRules: ArrayLike<number>
	) {
		this.ruleUrgency = new Uint8Array(rules.length / RULE_STRIDE);
		this.ruleBand = new Uint8Array(rules.length / RULE_STRIDE);
		this.arcValue = new Uint8Array(arcRuleOffsets.length - 1);
	}

	/** Fills `arcValue` with the `Urgency` of each arc at (`today`, `minute`). */
	computeUrgency(today: number, minute: number): Uint8Array {
		for (let r = 0; r < this.ruleUrgency.length; r++) {
			if (
				ruleMatchesDay(this.rules, r, today) &&
				minute >= ruleEffectiveEnd(this.rules, r)
			) {
				this.ruleUrgency[r] = Urgency.DoneToday;
				continue;
			}
			const day = nextRelevantDay(this.rules, r, today, minute);
			const active = day === today && minute >= ruleFrom(this.rules, r);
			this.ruleUrgency[r] = urgencyOf(day < 0 ? -1 : day - today, active);
		}
		return this.reduceArcs(this.ruleUrgency, Urgency.None);
	}

	/** Fills `arcValue` with the `TimeBand` swept on `day`, or `NO_BAND`. */
	computeDayBands(day: number): Uint8Array {
		for (let r = 0; r < this.ruleBand.length; r++) {
			this.ruleBand[r] = ruleMatchesDay(this.rules, r, day)
				? timeBandOf(ruleFrom(this.rules, r))
				: NO_BAND;
		}
		return this.reduceArcs(this.ruleBand, NO_BAND);
	}

	/** Per arc: minimum of the per-rule values. */
	private reduceArcs(perRule: Uint8Array, empty: number): Uint8Array {
		const arcs = this.arcValue.length;
		for (let a = 0; a < arcs; a++) {
			let best = empty;
			for (
				let j = this.arcRuleOffsets[a]!;
				j < this.arcRuleOffsets[a + 1]!;
				j++
			) {
				const v = perRule[this.arcRules[j]!]!;
				if (v < best) best = v;
			}
			this.arcValue[a] = best;
		}
		return this.arcValue;
	}
}
