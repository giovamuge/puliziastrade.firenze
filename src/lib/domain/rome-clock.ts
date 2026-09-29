import { daysFromCivil } from "./civil-date";

/**
 * Wall-clock time in Florence, independent of the device/server time zone.
 * Mutable on purpose: callers keep one instance and refresh it, so ticking
 * the clock every minute never allocates.
 */
export interface RomeInstant {
	/** Day number (days since 1970-01-01) of the current date in Europe/Rome. */
	day: number;
	/** Minutes since local midnight in Europe/Rome. */
	minute: number;
}

export const TIME_ZONE = "Europe/Rome";

let formatter: Intl.DateTimeFormat | undefined;

function getFormatter(): Intl.DateTimeFormat {
	formatter ??= new Intl.DateTimeFormat("en-GB", {
		timeZone: TIME_ZONE,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		hourCycle: "h23",
	});
	return formatter;
}

/** Writes the Europe/Rome wall time of `epochMs` into `out` and returns it. */
export function readRomeInstant(
	epochMs: number,
	out: RomeInstant = { day: 0, minute: 0 }
): RomeInstant {
	let year = 0;
	let month = 0;
	let day = 0;
	let hour = 0;
	let minute = 0;
	for (const part of getFormatter().formatToParts(epochMs)) {
		switch (part.type) {
			case "year":
				year = Number(part.value);
				break;
			case "month":
				month = Number(part.value);
				break;
			case "day":
				day = Number(part.value);
				break;
			case "hour":
				hour = Number(part.value);
				break;
			case "minute":
				minute = Number(part.value);
				break;
		}
	}
	out.day = daysFromCivil(year, month, day);
	out.minute = hour * 60 + minute;
	return out;
}

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

/**
 * Converts a Europe/Rome wall time to epoch milliseconds (UTC), handling
 * DST by measuring the zone offset at a nearby instant and correcting once.
 */
export function romeLocalToEpochMs(day: number, minute: number): number {
	const asIfUtc = day * MS_PER_DAY + minute * MS_PER_MINUTE;
	const probe: RomeInstant = { day: 0, minute: 0 };
	let guess = asIfUtc - 60 * MS_PER_MINUTE; // CET
	for (let i = 0; i < 2; i++) {
		readRomeInstant(guess, probe);
		const offset =
			probe.day * MS_PER_DAY + probe.minute * MS_PER_MINUTE - guess;
		guess = asIfUtc - offset;
	}
	return guess;
}
