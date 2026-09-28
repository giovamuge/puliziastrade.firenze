import { describe, expect, it } from 'vitest';
import { daysFromCivil } from './civil-date';
import { icsLocalStamp, recurrencesFor } from './recurrence';
import { WeekKind } from './schedule';

// Monday 28 September 2026.
const today = daysFromCivil(2026, 9, 28);
const MON = 0;
const TUE = 1;
const WED = 2;

describe('recurrencesFor', () => {
	it('maps n-th weekdays to a monthly BYDAY and anchors on the next match', () => {
		const [r] = recurrencesFor([{ weekday: TUE, kinds: [WeekKind.Nth3, WeekKind.Nth1], from: 420, to: 720 }], today, 600);
		expect(r!.rrule).toBe('FREQ=MONTHLY;BYDAY=1TU,3TU');
		expect(r!.day).toBe(daysFromCivil(2026, 10, 6));
	});

	it('skips today when the window has already ended', () => {
		const [r] = recurrencesFor([{ weekday: MON, kinds: [WeekKind.Every], from: 420, to: 720 }], today, 13 * 60);
		expect(r!.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
		expect(r!.day).toBe(daysFromCivil(2026, 10, 5));
	});

	it('keeps today while the window is still open', () => {
		const [r] = recurrencesFor([{ weekday: MON, kinds: [WeekKind.Every], from: 420, to: 720 }], today, 600);
		expect(r!.day).toBe(today);
	});

	it('maps odd days to BYMONTHDAY and splits mixed kinds', () => {
		const rs = recurrencesFor([{ weekday: WED, kinds: [WeekKind.Nth2, WeekKind.OddDays], from: 0, to: 360 }], today, 0);
		expect(rs.map((r) => r.rrule)).toEqual(['FREQ=MONTHLY;BYDAY=WE;BYMONTHDAY=1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31', 'FREQ=MONTHLY;BYDAY=2WE']);
		expect(rs[0]!.day).toBe(daysFromCivil(2026, 10, 7));
		expect(rs[1]!.day).toBe(daysFromCivil(2026, 10, 14));
	});

	it('treats odd plus even days as every week', () => {
		const rs = recurrencesFor([{ weekday: WED, kinds: [WeekKind.OddDays, WeekKind.EvenDays], from: 0, to: 360 }], today, 0);
		expect(rs.map((r) => r.rrule)).toEqual(['FREQ=WEEKLY;BYDAY=WE']);
	});
});

describe('icsLocalStamp', () => {
	it('rolls 24:00 into the next day', () => {
		expect(icsLocalStamp(today, 1440)).toBe('20260929T000000');
	});
});
