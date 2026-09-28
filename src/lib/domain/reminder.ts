import type { AlarmOption } from '$lib/api/contracts';

/** "auto": sweeps starting before 08:00 are reminded at 20:00 the evening before, others 2 h before. */
const EARLY_START = 8 * 60;
const EVENING_REMINDER = 20 * 60;

export interface WallTime {
	day: number;
	minute: number;
}

/**
 * Europe/Rome wall time of the reminder for a sweep starting on `day` at
 * `from`, or null when no reminder is wanted. Shared by the ICS generator
 * and the UI preview so they always agree.
 */
export function alarmWallTime(option: AlarmOption, day: number, from: number): WallTime | null {
	const evening = { day: day - 1, minute: EVENING_REMINDER };
	const before = (minutes: number): WallTime => {
		const m = from - minutes;
		return m >= 0 ? { day, minute: m } : { day: day - 1, minute: m + 1440 };
	};
	switch (option) {
		case 'none':
			return null;
		case 'evening':
			return evening;
		case '120':
			return before(120);
		case '60':
			return before(60);
		case 'auto':
			return from < EARLY_START ? evening : before(120);
	}
}

/**
 * Minutes between the reminder and a sweep starting at `from`, or null for no
 * reminder. Recurring events need this relative form: an absolute trigger
 * would only fire once.
 */
export function alarmMinutesBefore(option: AlarmOption, from: number): number | null {
	const wall = alarmWallTime(option, 0, from);
	return wall ? from - (wall.day * 1440 + wall.minute) : null;
}
