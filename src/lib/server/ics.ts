/**
 * Minimal RFC 5545 (iCalendar) writer. Builder pattern: accumulate events,
 * then `build()` produces CRLF-terminated, 75-octet folded content.
 */

export interface IcsEvent {
	uid: string;
	/** Local Europe/Rome wall time, `YYYYMMDDTHHMMSS`. */
	start: string;
	end: string;
	summary: string;
	description?: string;
	location?: string;
	url?: string;
	/** Absolute alarm time in UTC, `YYYYMMDDTHHMMSSZ`. */
	alarmAt?: string;
	alarmText?: string;
}

const encoder = new TextEncoder();

export function escapeText(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets without splitting UTF-8 sequences. */
export function foldLine(line: string): string {
	if (encoder.encode(line).length <= 75) return line;
	const parts: string[] = [];
	let current = '';
	let bytes = 0;
	for (const ch of line) {
		const size = encoder.encode(ch).length;
		const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
		if (bytes + size > limit) {
			parts.push(current);
			current = '';
			bytes = 0;
		}
		current += ch;
		bytes += size;
	}
	parts.push(current);
	return parts.join('\r\n ');
}

/** Europe/Rome definition so every client renders local times correctly. */
const VTIMEZONE_ROME = [
	'BEGIN:VTIMEZONE',
	'TZID:Europe/Rome',
	'X-LIC-LOCATION:Europe/Rome',
	'BEGIN:DAYLIGHT',
	'TZOFFSETFROM:+0100',
	'TZOFFSETTO:+0200',
	'TZNAME:CEST',
	'DTSTART:19700329T020000',
	'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
	'END:DAYLIGHT',
	'BEGIN:STANDARD',
	'TZOFFSETFROM:+0200',
	'TZOFFSETTO:+0100',
	'TZNAME:CET',
	'DTSTART:19701025T030000',
	'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
	'END:STANDARD',
	'END:VTIMEZONE'
];

export class IcsCalendarBuilder {
	private readonly events: IcsEvent[] = [];

	constructor(
		private readonly name: string,
		private readonly description: string,
		private readonly stamp: string
	) {}

	add(event: IcsEvent): this {
		this.events.push(event);
		return this;
	}

	build(): string {
		const lines = [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//puliziastrade-firenze//IT',
			'CALSCALE:GREGORIAN',
			'METHOD:PUBLISH',
			`X-WR-CALNAME:${escapeText(this.name)}`,
			`X-WR-CALDESC:${escapeText(this.description)}`,
			'X-WR-TIMEZONE:Europe/Rome',
			'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
			'X-PUBLISHED-TTL:PT12H',
			...VTIMEZONE_ROME
		];
		for (const e of this.events) {
			lines.push(
				'BEGIN:VEVENT',
				`UID:${e.uid}`,
				`DTSTAMP:${this.stamp}`,
				`DTSTART;TZID=Europe/Rome:${e.start}`,
				`DTEND;TZID=Europe/Rome:${e.end}`,
				`SUMMARY:${escapeText(e.summary)}`,
				'TRANSP:TRANSPARENT',
				'CATEGORIES:Pulizia strade'
			);
			if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
			if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
			if (e.url) lines.push(`URL:${e.url}`);
			if (e.alarmAt) {
				lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.alarmText ?? e.summary)}`, `TRIGGER;VALUE=DATE-TIME:${e.alarmAt}`, 'END:VALARM');
			}
			lines.push('END:VEVENT');
		}
		lines.push('END:VCALENDAR');
		return lines.map(foldLine).join('\r\n') + '\r\n';
	}
}
