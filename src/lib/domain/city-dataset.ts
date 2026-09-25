import type { Weekday } from './civil-date';
import {
	RULE_STRIDE,
	nextRelevantDay,
	ruleEffectiveEnd,
	ruleFrom,
	ruleKind,
	ruleMatchesDay,
	ruleTo,
	ruleWeekday
} from './schedule';
import { COORD_SCALE, type DatasetSnapshot, type StreetRecord } from './snapshot';
import type { RuleLike } from './describe';

/**
 * Read-optimised, in-memory view of a snapshot. All relations are stored as
 * CSR (compressed sparse row) typed arrays: `xOffsets[i]..xOffsets[i+1]` is
 * the slice of `x` belonging to item `i`. Queries iterate these slices
 * directly, without creating intermediate arrays.
 */
export class CityDataset {
	readonly version: string;
	readonly streets: readonly StreetRecord[];
	readonly rules: Int16Array;
	readonly ruleCount: number;

	readonly arcCount: number;
	readonly arcCodes: readonly string[];
	readonly arcStreet: Int32Array;
	readonly arcRuleOffsets: Int32Array;
	readonly arcRules: Int32Array;
	readonly arcPointOffsets: Int32Array;
	readonly lon: Float64Array;
	readonly lat: Float64Array;

	readonly streetArcOffsets: Int32Array;
	readonly streetArcs: Int32Array;
	readonly streetRuleOffsets: Int32Array;
	readonly streetRules: Int32Array;

	private readonly slugToStreet: Map<string, number>;
	private readonly codeToArc: Map<string, number>;

	constructor(readonly snapshot: DatasetSnapshot) {
		this.version = snapshot.version;
		this.streets = snapshot.streets;
		this.rules = Int16Array.from(snapshot.rules);
		this.ruleCount = snapshot.rules.length / RULE_STRIDE;

		const arcs = snapshot.arcs;
		this.arcCount = arcs.length;
		this.arcCodes = arcs.map((a) => a.code);
		this.arcStreet = Int32Array.from(arcs, (a) => a.street);
		this.arcPointOffsets = Int32Array.from(snapshot.coordOffsets);

		this.arcRuleOffsets = new Int32Array(arcs.length + 1);
		for (let i = 0; i < arcs.length; i++) this.arcRuleOffsets[i + 1] = this.arcRuleOffsets[i]! + arcs[i]!.rules.length;
		this.arcRules = new Int32Array(this.arcRuleOffsets[arcs.length]!);
		for (let i = 0, w = 0; i < arcs.length; i++) for (const r of arcs[i]!.rules) this.arcRules[w++] = r;

		const points = snapshot.coords.length / 2;
		this.lon = new Float64Array(points);
		this.lat = new Float64Array(points);
		for (let p = 0; p < points; p++) {
			this.lon[p] = snapshot.coords[p * 2]! / COORD_SCALE;
			this.lat[p] = snapshot.coords[p * 2 + 1]! / COORD_SCALE;
		}

		// street → arcs (counting sort, arcs are already grouped but we don't rely on it)
		const streetCount = snapshot.streets.length;
		this.streetArcOffsets = new Int32Array(streetCount + 1);
		for (let a = 0; a < arcs.length; a++) this.streetArcOffsets[this.arcStreet[a]! + 1]!++;
		for (let s = 0; s < streetCount; s++) this.streetArcOffsets[s + 1]! += this.streetArcOffsets[s]!;
		this.streetArcs = new Int32Array(arcs.length);
		const cursor = this.streetArcOffsets.slice(0, streetCount);
		for (let a = 0; a < arcs.length; a++) this.streetArcs[cursor[this.arcStreet[a]!]!++] = a;

		// street → distinct rules
		const perStreet: number[][] = Array.from({ length: streetCount }, () => []);
		for (let a = 0; a < arcs.length; a++) {
			const list = perStreet[this.arcStreet[a]!]!;
			for (const r of arcs[a]!.rules) if (!list.includes(r)) list.push(r);
		}
		this.streetRuleOffsets = new Int32Array(streetCount + 1);
		for (let s = 0; s < streetCount; s++) this.streetRuleOffsets[s + 1] = this.streetRuleOffsets[s]! + perStreet[s]!.length;
		this.streetRules = Int32Array.from(perStreet.flat());

		this.slugToStreet = new Map(snapshot.streets.map((s, i) => [s.slug, i]));
		this.codeToArc = new Map(this.arcCodes.map((c, i) => [c, i]));
	}

	get streetCount(): number {
		return this.streets.length;
	}

	streetBySlug(slug: string): number {
		return this.slugToStreet.get(slug) ?? -1;
	}

	arcByCode(code: string): number {
		return this.codeToArc.get(code) ?? -1;
	}

	ruleLike(rule: number): RuleLike {
		return {
			weekday: ruleWeekday(this.rules, rule),
			kind: ruleKind(this.rules, rule),
			from: ruleFrom(this.rules, rule),
			to: ruleTo(this.rules, rule)
		};
	}

	/**
	 * Soonest relevant occurrence among `rules[start..end)` of `ruleIds`.
	 * Writes into `out` (no allocation). `out.day` is -1 when nothing is scheduled.
	 */
	soonest(ruleIds: Int32Array, start: number, end: number, today: number, minute: number, out: SoonestOccurrence): SoonestOccurrence {
		out.day = -1;
		out.rule = -1;
		for (let i = start; i < end; i++) {
			const rule = ruleIds[i]!;
			const day = nextRelevantDay(this.rules, rule, today, minute);
			if (day < 0) continue;
			if (out.day < 0 || day < out.day || (day === out.day && ruleFrom(this.rules, rule) < ruleFrom(this.rules, out.rule))) {
				out.day = day;
				out.rule = rule;
			}
		}
		return out;
	}

	soonestForStreet(street: number, today: number, minute: number, out: SoonestOccurrence): SoonestOccurrence {
		return this.soonest(this.streetRules, this.streetRuleOffsets[street]!, this.streetRuleOffsets[street + 1]!, today, minute, out);
	}

	soonestForArc(arc: number, today: number, minute: number, out: SoonestOccurrence): SoonestOccurrence {
		return this.soonest(this.arcRules, this.arcRuleOffsets[arc]!, this.arcRuleOffsets[arc + 1]!, today, minute, out);
	}

	/**
	 * Enumerates street occurrences in `[fromDay, toDay]`, merging segments that
	 * share the same day and time window. Allocates the result (API edge).
	 */
	occurrencesForStreet(street: number, fromDay: number, toDay: number, arcFilter: ReadonlySet<number> | null = null): Occurrence[] {
		const result: Occurrence[] = [];
		const arcStart = this.streetArcOffsets[street]!;
		const arcEnd = this.streetArcOffsets[street + 1]!;
		const totalArcs = arcFilter ? arcFilter.size : arcEnd - arcStart;
		for (let day = fromDay; day <= toDay; day++) {
			const windows = new Map<number, Occurrence>();
			for (let i = arcStart; i < arcEnd; i++) {
				const arc = this.streetArcs[i]!;
				if (arcFilter && !arcFilter.has(arc)) continue;
				for (let j = this.arcRuleOffsets[arc]!; j < this.arcRuleOffsets[arc + 1]!; j++) {
					const rule = this.arcRules[j]!;
					if (!ruleMatchesDay(this.rules, rule, day)) continue;
					const from = ruleFrom(this.rules, rule);
					const to = ruleTo(this.rules, rule);
					const key = from * 2000 + to;
					const existing = windows.get(key);
					if (existing) {
						if (!existing.arcCodes.includes(this.arcCodes[arc]!)) existing.arcCodes.push(this.arcCodes[arc]!);
					} else {
						windows.set(key, { day, weekday: ruleWeekday(this.rules, rule), from, to, end: ruleEffectiveEnd(this.rules, rule), arcCodes: [this.arcCodes[arc]!], totalArcs });
					}
				}
			}
			for (const occurrence of [...windows.values()].sort((a, b) => a.from - b.from)) result.push(occurrence);
		}
		return result;
	}
}

export interface SoonestOccurrence {
	day: number;
	rule: number;
}

export interface Occurrence {
	day: number;
	weekday: Weekday;
	from: number;
	to: number;
	/** Effective end minute (see `ruleEffectiveEnd`). */
	end: number;
	arcCodes: string[];
	totalArcs: number;
}
