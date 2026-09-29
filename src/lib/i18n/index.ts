import type { RuleDto } from "$lib/api/contracts";
import { formatMinutes } from "$lib/domain/civil-date";
import { WeekKind } from "$lib/domain/schedule";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it, type Messages } from "./it";
import type { Locale } from "./locales";

export * from "./locales";
export type { Messages };

export const MESSAGES: Record<Locale, Messages> = { it, en, es, fr, de };

const MS_PER_DAY = 86_400_000;
/** 2024-01-01 was a Monday: day number of our weekday 0. */
const MONDAY = Date.UTC(2024, 0, 1) / MS_PER_DAY;

/**
 * Locale-aware formatting. One instance per locale (cached), with its Intl
 * objects created once. Pure: usable on the server (ICS) and the client.
 */
export class Formatter {
	readonly m: Messages;
	private readonly longDateFmt: Intl.DateTimeFormat;
	private readonly shortDateFmt: Intl.DateTimeFormat;
	private readonly weekdayFmt: Intl.DateTimeFormat;
	private readonly weekdayShortFmt: Intl.DateTimeFormat;
	private readonly dateTimeFmt: Intl.DateTimeFormat;
	private readonly numberFmt: Intl.NumberFormat;
	private readonly decimalFmt: Intl.NumberFormat;
	private readonly listFmt: Intl.ListFormat;

	constructor(readonly locale: Locale) {
		this.m = MESSAGES[locale];
		this.longDateFmt = new Intl.DateTimeFormat(locale, {
			weekday: "long",
			day: "numeric",
			month: "long",
			timeZone: "UTC",
		});
		this.shortDateFmt = new Intl.DateTimeFormat(locale, {
			weekday: "short",
			day: "numeric",
			month: "short",
			timeZone: "UTC",
		});
		this.weekdayFmt = new Intl.DateTimeFormat(locale, {
			weekday: "long",
			timeZone: "UTC",
		});
		this.weekdayShortFmt = new Intl.DateTimeFormat(locale, {
			weekday: "short",
			timeZone: "UTC",
		});
		this.dateTimeFmt = new Intl.DateTimeFormat(locale, {
			dateStyle: "long",
			timeStyle: "short",
			timeZone: "Europe/Rome",
		});
		this.numberFmt = new Intl.NumberFormat(locale);
		this.decimalFmt = new Intl.NumberFormat(locale, {
			maximumFractionDigits: 1,
		});
		this.listFmt = new Intl.ListFormat(locale, {
			style: "long",
			type: "conjunction",
		});
	}

	/** Day number → "giovedì 24 settembre" (capitalised when `capital`). */
	longDate(day: number, capital = false): string {
		const text = this.longDateFmt.format(day * MS_PER_DAY);
		return capital ? capitalize(text, this.locale) : text;
	}
	shortDate(day: number): string {
		return capitalize(
			this.shortDateFmt.format(day * MS_PER_DAY),
			this.locale
		);
	}
	/** Weekday name of a day number. */
	weekdayOfDay(day: number): string {
		return this.weekdayFmt.format(day * MS_PER_DAY);
	}
	/** Weekday name by index (Mon = 0). */
	weekday(index: number): string {
		return this.weekdayOfDay(MONDAY + index);
	}
	dateTime(iso: string | null): string {
		return iso
			? this.dateTimeFmt.format(new Date(iso))
			: this.m.info.notAvailable;
	}
	number(n: number): string {
		return this.numberFmt.format(n);
	}
	decimal(n: number): string {
		return this.decimalFmt.format(n);
	}
	list(items: string[]): string {
		return this.listFmt.format(items);
	}
	distance(meters: number): string {
		return meters < 1000
			? `${this.number(Math.round(meters / 5) * 5)} m`
			: `${this.decimal(meters / 1000)} km`;
	}
	timeWindow(from: number, to: number): string {
		return to > from
			? `${formatMinutes(from)}–${formatMinutes(to)}`
			: this.m.rules.from(formatMinutes(from));
	}

	/** "1° e 3° martedì del mese, 00:00–06:00", "every Thursday, 13:00–18:00"… */
	rule(rule: RuleDto): string {
		const { rules } = this.m;
		const day = this.weekday(rule.weekday);
		const time = this.timeWindow(rule.from, rule.to);
		if (rule.kinds.includes(WeekKind.Every))
			return `${rules.every(day)}, ${time}`;
		const parts: string[] = [];
		const nth = rule.kinds
			.filter((k) => k >= WeekKind.Nth1 && k <= WeekKind.Nth5)
			.sort((a, b) => a - b);
		if (nth.length)
			parts.push(rules.nth(this.list(nth.map(rules.ordinal)), day));
		if (rule.kinds.includes(WeekKind.OddDays)) parts.push(rules.odd(day));
		if (rule.kinds.includes(WeekKind.EvenDays)) parts.push(rules.even(day));
		return capitalize(`${parts.join("; ")}, ${time}`, this.locale);
	}

	/**
	 * Compact rule for map labels and tooltips: "4° gio 07–12", "mer dispari 0–6".
	 * Whole hours drop the ":00" to keep labels short along the road.
	 */
	ruleShort(rule: RuleDto): string {
		const { rules } = this.m;
		const day = this.weekdayShortFmt
			.format((MONDAY + rule.weekday) * MS_PER_DAY)
			.replace(/\.$/, "");
		const time =
			rule.to > rule.from
				? `${compactTime(rule.from)}–${compactTime(rule.to)}`
				: compactTime(rule.from);
		if (rule.kinds.includes(WeekKind.Every))
			return `${rules.everyShort} ${day} ${time}`;
		const parts: string[] = [];
		const nth = rule.kinds
			.filter((k) => k >= WeekKind.Nth1 && k <= WeekKind.Nth5)
			.sort((a, b) => a - b);
		if (nth.length)
			parts.push(`${nth.map(rules.ordinal).join("/")} ${day}`);
		if (rule.kinds.includes(WeekKind.OddDays))
			parts.push(`${day} ${rules.oddShort}`);
		if (rule.kinds.includes(WeekKind.EvenDays))
			parts.push(`${day} ${rules.evenShort}`);
		return `${parts.join(", ")} ${time}`;
	}

	/** Label for a street part: "tra A e B", "vicino a A", or a numbered fallback. */
	between(names: string[], fallbackIndex: number): string {
		const [a, b] = names;
		if (a && b) return this.m.street.between(a, b);
		if (a) return this.m.street.near(a);
		return this.m.street.groupFallback(fallbackIndex + 1);
	}
}

function compactTime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m === 0 ? `${h}` : `${h}:${m < 10 ? "0" : ""}${m}`;
}

export function capitalize(text: string, locale: string): string {
	return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

const formatters = new Map<Locale, Formatter>();

export function formatterFor(locale: Locale): Formatter {
	let f = formatters.get(locale);
	if (!f) formatters.set(locale, (f = new Formatter(locale)));
	return f;
}
