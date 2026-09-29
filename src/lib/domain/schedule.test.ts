import { describe, expect, it } from "vitest";
import {
	daysFromCivil,
	civilFromDays,
	parseIsoDate,
	toIsoDate,
	weekdayOf,
} from "./civil-date";
import {
	WeekKind,
	nextRelevantDay,
	nextRuleDay,
	ruleMatchesDay,
} from "./schedule";
import { groupRules } from "./describe";
import { formatterFor, LOCALES } from "$lib/i18n";
import { Urgency, UrgencyCalculator } from "./urgency";
import { romeLocalToEpochMs, readRomeInstant } from "./rome-clock";

const day = (iso: string) => parseIsoDate(iso);
const TUE = 1;
const THU = 3;

describe("civil date arithmetic", () => {
	it("round-trips dates across eras and leap years", () => {
		for (const iso of [
			"1970-01-01",
			"2000-02-29",
			"2024-12-31",
			"2026-09-24",
			"2100-03-01",
		]) {
			expect(toIsoDate(day(iso))).toBe(iso);
		}
		expect(daysFromCivil(1970, 1, 1)).toBe(0);
		expect(civilFromDays(0)).toBe(19700101);
	});

	it("computes ISO weekdays (Mon=0)", () => {
		expect(weekdayOf(day("2026-09-24"))).toBe(THU);
		expect(weekdayOf(day("2026-09-28"))).toBe(0);
		expect(weekdayOf(day("1969-12-31"))).toBe(2);
	});

	it("rejects impossible dates", () => {
		expect(parseIsoDate("2026-02-30")).toBeNaN();
		expect(parseIsoDate("nope")).toBeNaN();
	});
});

describe("recurrence rules", () => {
	it('"prima settimana" is the first weekday of the month', () => {
		const rules = [TUE, WeekKind.Nth1, 0, 360];
		expect(toIsoDate(nextRuleDay(rules, 0, day("2026-09-24")))).toBe(
			"2026-10-06"
		);
	});

	it('"quinta settimana" skips months without a fifth weekday', () => {
		const rules = [TUE, WeekKind.Nth5, 0, 360];
		// Sep 2026 has Tue 29 → next from Sep 30 is Dec 29
		expect(toIsoDate(nextRuleDay(rules, 0, day("2026-09-30")))).toBe(
			"2026-12-29"
		);
	});

	it('"settimane dispari/pari" follow the parity of the day of month', () => {
		const odd = [THU, WeekKind.OddDays, 0, 360];
		const even = [THU, WeekKind.EvenDays, 0, 360];
		expect(ruleMatchesDay(odd, 0, day("2026-09-17"))).toBe(true);
		expect(ruleMatchesDay(odd, 0, day("2026-09-24"))).toBe(false);
		expect(ruleMatchesDay(even, 0, day("2026-09-24"))).toBe(true);
	});

	it("keeps today while the window is still open, then moves on", () => {
		const rules = [THU, WeekKind.Every, 13 * 60, 18 * 60];
		const today = day("2026-09-24");
		expect(nextRelevantDay(rules, 0, today, 12 * 60)).toBe(today);
		expect(nextRelevantDay(rules, 0, today, 17 * 60)).toBe(today);
		expect(nextRelevantDay(rules, 0, today, 18 * 60)).toBe(today + 7);
	});
});

describe("descriptions", () => {
	const rules = groupRules([
		{ weekday: TUE, kind: WeekKind.Nth3, from: 0, to: 360 },
		{ weekday: TUE, kind: WeekKind.Nth1, from: 0, to: 360 },
		{ weekday: THU, kind: WeekKind.OddDays, from: 780, to: 1110 },
	]);

	it("groups ordinals by weekday and window, localised", () => {
		const it_ = formatterFor("it");
		expect(rules.map((r) => it_.rule(r))).toEqual([
			"1° e 3° martedì del mese, 00:00–06:00",
			"Giovedì nei giorni dispari, 13:00–18:30",
		]);
		expect(formatterFor("en").rule(rules[0]!)).toBe(
			"1st and 3rd Tuesday of the month, 00:00–06:00"
		);
		expect(formatterFor("de").rule(rules[1]!)).toBe(
			"Donnerstag an ungeraden Tagen, 13:00–18:30"
		);
		for (const locale of LOCALES)
			expect(formatterFor(locale).rule(rules[0]!)).toMatch(
				/00:00–06:00$/
			);
	});

	it("formats compact labels for the map", () => {
		expect(formatterFor("it").ruleShort(rules[0]!)).toBe("1°/3° mar 0–6");
		expect(formatterFor("it").ruleShort(rules[1]!)).toBe(
			"gio dispari 13–18:30"
		);
		expect(formatterFor("en").ruleShort(rules[0]!)).toBe("1st/3rd Tue 0–6");
	});

	it("labels street parts by their cross streets", () => {
		const f = formatterFor("it");
		expect(f.between(["Via A", "Via B"], 0)).toBe("tra Via A e Via B");
		expect(f.between(["Via A"], 0)).toBe("vicino a Via A");
		expect(f.between([], 1)).toBe("Tratto 2");
	});
});

describe("urgency calculator", () => {
	it("classifies arcs without reallocating", () => {
		const today = day("2026-09-24"); // Thursday
		const rules = [
			THU,
			WeekKind.Every,
			0,
			360,
			4,
			WeekKind.Every,
			0,
			360,
			0,
			WeekKind.Nth5,
			0,
			360,
		];
		const calc = new UrgencyCalculator(rules, [0, 1, 2, 3], [0, 1, 2]);
		const out = calc.computeUrgency(today, 60);
		expect(Array.from(out)).toEqual([
			Urgency.Now,
			Urgency.Tomorrow,
			Urgency.Later,
		]);
		expect(calc.computeUrgency(today, 60)).toBe(out);
		// After 06:00 today's sweep is over: "done today" wins over next week's.
		expect(Array.from(calc.computeUrgency(today, 7 * 60))).toEqual([
			Urgency.DoneToday,
			Urgency.Tomorrow,
			Urgency.Later,
		]);
	});
});

describe("rome clock", () => {
	it("converts wall time to UTC across DST", () => {
		expect(
			new Date(
				romeLocalToEpochMs(day("2026-01-15"), 20 * 60)
			).toISOString()
		).toBe("2026-01-15T19:00:00.000Z");
		expect(
			new Date(
				romeLocalToEpochMs(day("2026-07-15"), 20 * 60)
			).toISOString()
		).toBe("2026-07-15T18:00:00.000Z");
		const inst = readRomeInstant(Date.UTC(2026, 6, 15, 22, 30));
		expect(toIsoDate(inst.day)).toBe("2026-07-16");
		expect(inst.minute).toBe(30);
	});
});
