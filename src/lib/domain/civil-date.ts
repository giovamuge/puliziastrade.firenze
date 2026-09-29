/**
 * Civil calendar arithmetic on plain integers.
 *
 * A "day number" is the count of days since 1970-01-01 in the proleptic
 * Gregorian calendar. Every function here is branch-light, pure and
 * allocation-free, so it can run inside hot loops (thousands of street
 * segments per frame) without pressuring the garbage collector.
 *
 * Algorithms: Howard Hinnant, "chrono-Compatible Low-Level Date Algorithms".
 */

/** Monday = 0 … Sunday = 6 (ISO order, the one used by the dataset). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function daysFromCivil(
	year: number,
	month: number,
	day: number
): number {
	const y = month <= 2 ? year - 1 : year;
	const era = Math.floor(y / 400);
	const yoe = y - era * 400;
	const mp = (month + 9) % 12;
	const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
	return era * 146097 + doe - 719468;
}

/**
 * Packs the civil date of `dayNumber` into a single integer `YYYYMMDD`,
 * avoiding the allocation of a tuple/object.
 */
export function civilFromDays(dayNumber: number): number {
	const z = dayNumber + 719468;
	const era = Math.floor(z / 146097);
	const doe = z - era * 146097;
	const yoe = Math.floor(
		(doe -
			Math.floor(doe / 1460) +
			Math.floor(doe / 36524) -
			Math.floor(doe / 146096)) /
			365
	);
	const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
	const mp = Math.floor((5 * doy + 2) / 153);
	const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
	const month = mp < 10 ? mp + 3 : mp - 9;
	const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
	return year * 10000 + month * 100 + day;
}

export const packedYear = (packed: number): number =>
	Math.floor(packed / 10000);
export const packedMonth = (packed: number): number =>
	Math.floor(packed / 100) % 100;
export const packedDay = (packed: number): number => packed % 100;

export function dayOfMonth(dayNumber: number): number {
	return civilFromDays(dayNumber) % 100;
}

/** 1970-01-01 was a Thursday (index 3). */
export function weekdayOf(dayNumber: number): Weekday {
	return ((((dayNumber + 3) % 7) + 7) % 7) as Weekday;
}

/** ISO-8601 `YYYY-MM-DD`. Allocates a string: use only at the edges (UI, I/O). */
export function toIsoDate(dayNumber: number): string {
	const p = civilFromDays(dayNumber);
	return `${packedYear(p)}-${pad2(packedMonth(p))}-${pad2(packedDay(p))}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD`; returns `NaN` on malformed or impossible dates. */
export function parseIsoDate(value: string): number {
	const m = ISO_DATE.exec(value);
	if (!m) return Number.NaN;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	const dn = daysFromCivil(y, mo, d);
	return civilFromDays(dn) === y * 10000 + mo * 100 + d ? dn : Number.NaN;
}

export function pad2(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

/** Minutes since midnight → `HH:MM`. */
export function formatMinutes(minutes: number): string {
	return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}
