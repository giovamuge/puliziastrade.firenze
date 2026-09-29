/**
 * Street name normalisation. The source data is upper-case ("VIA DELL'ARGIN
 * GROSSO"); we present it in Italian title case ("Via dell'Argin Grosso") and
 * derive a stable URL slug from it.
 */

const LOWERCASE_PARTICLES = new Set([
	"a",
	"ai",
	"al",
	"alla",
	"alle",
	"agli",
	"all",
	"da",
	"dal",
	"dalla",
	"dai",
	"dagli",
	"dall",
	"de",
	"dei",
	"del",
	"della",
	"delle",
	"degli",
	"dell",
	"di",
	"d",
	"e",
	"ed",
	"in",
	"il",
	"la",
	"le",
	"lo",
	"gli",
	"i",
	"l",
	"nel",
	"nella",
	"per",
	"sul",
	"sulla",
	"sotto",
	"fra",
	"tra",
	"con",
]);

const ROMAN_NUMERAL =
	/^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;

function capitalize(word: string): string {
	return word.charAt(0).toLocaleUpperCase("it") + word.slice(1);
}

function formatWord(word: string, isFirst: boolean): string {
	if (!isFirst && LOWERCASE_PARTICLES.has(word)) return word;
	if (ROMAN_NUMERAL.test(word)) return word.toLocaleUpperCase("it");
	// Handle elisions: "dell'argin" → "dell'Argin"
	const apostrophe = word.indexOf("'");
	if (apostrophe > 0 && apostrophe < word.length - 1) {
		const head = word.slice(0, apostrophe);
		const tail = word.slice(apostrophe + 1);
		const formattedHead =
			!isFirst && LOWERCASE_PARTICLES.has(head) ? head : capitalize(head);
		return `${formattedHead}'${capitalize(tail)}`;
	}
	return word.split("-").map(capitalize).join("-");
}

const GRAVE: Record<string, string> = {
	A: "À",
	E: "È",
	I: "Ì",
	O: "Ò",
	U: "Ù",
};

/** Upper-case sources write accents as apostrophes: "NICCOLO'" → "NICCOLÒ". */
function restoreAccents(raw: string): string {
	return raw.replace(
		/([AEIOU])'(?=\s|$)/g,
		(_, vowel: string) => GRAVE[vowel]!
	);
}

export function prettifyStreetName(raw: string): string {
	return restoreAccents(raw)
		.trim()
		.replace(/\s+/g, " ")
		.toLocaleLowerCase("it")
		.split(" ")
		.map((word, i) => formatWord(word, i === 0))
		.join(" ");
}

/** Removes diacritics and lower-cases: "Viale Niccolò" → "viale niccolo". */
export function foldText(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}+/gu, "")
		.toLocaleLowerCase("it");
}

export function slugifyStreetName(name: string): string {
	return foldText(name)
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** First word is the odonym type: VIA, PIAZZA, VIALE, LUNGARNO, BORGO… */
export function streetType(raw: string): string {
	const space = raw.trim().indexOf(" ");
	return prettifyStreetName(space < 0 ? raw : raw.trim().slice(0, space));
}
