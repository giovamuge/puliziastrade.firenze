import { describe, expect, it } from 'vitest';
import { groupStreetsByLetter, sortKey } from './street-index';

const street = (name: string, type = name.split(' ')[0]!) => ({ slug: name.toLowerCase().replace(/\W+/g, '-'), name, rawName: name, type });

describe('sortKey', () => {
	it('drops the odonym type and leading particles', () => {
		expect(sortKey(street('Via dei Servi'))).toBe('Servi');
		expect(sortKey(street("Via dell'Agnolo"))).toBe('Agnolo');
		expect(sortKey(street('Piazza della Signoria'))).toBe('Signoria');
		expect(sortKey(street('Lungarno Corsini'))).toBe('Corsini');
		expect(sortKey(street('Via Dante Alighieri'))).toBe('Dante Alighieri');
	});
});

describe('groupStreetsByLetter', () => {
	it('groups alphabetically, ignoring accents', () => {
		const groups = groupStreetsByLetter([street('Via dei Servi'), street("Via dell'Agnolo"), street('Piazza Ìsola'), street('Via Aretina')]);
		expect(groups.map((g) => g.letter)).toEqual(['A', 'I', 'S']);
		expect(groups[0]!.streets.map((s) => s.name)).toEqual(["Via dell'Agnolo", 'Via Aretina']);
	});
});
