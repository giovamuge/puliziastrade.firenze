import type { StreetRecord } from '$lib/domain/snapshot';

export interface IndexedStreet {
	slug: string;
	name: string;
}

export interface StreetLetter {
	letter: string;
	streets: IndexedStreet[];
}

/** Leading articles/prepositions skipped when sorting: "Via dei Servi" files under S. */
const LEADING =
	/^(?:(?:dell|dall|all|nell|de|d|l)['’]\s*|(?:della|dello|delle|dei|degli|del|di|da|dal|dalla|al|alla|alle|allo|ai|agli|il|lo|la|le|gli|i)\s+)/i;

/** Sort key: the name without its odonym type ("Via", "Piazza"…) and leading particles. */
export function sortKey(street: Pick<StreetRecord, 'name' | 'type'>): string {
	let key = street.name.startsWith(street.type) ? street.name.slice(street.type.length).trim() : street.name;
	for (let i = 0; i < 2 && LEADING.test(key); i++) key = key.replace(LEADING, '');
	return key || street.name;
}

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/** A–Z index of streets for the crawlable street list. */
export function groupStreetsByLetter(streets: readonly StreetRecord[]): StreetLetter[] {
	const keyed = streets.map((s) => ({ key: sortKey(s), slug: s.slug, name: s.name }));
	keyed.sort((a, b) => collator.compare(a.key, b.key) || collator.compare(a.name, b.name));
	const letters: StreetLetter[] = [];
	for (const { key, slug, name } of keyed) {
		const first = key.normalize('NFD').charAt(0).toUpperCase();
		const letter = /[A-Z]/.test(first) ? first : '#';
		const last = letters.at(-1);
		if (last?.letter === letter) last.streets.push({ slug, name });
		else letters.push({ letter, streets: [{ slug, name }] });
	}
	return letters;
}
