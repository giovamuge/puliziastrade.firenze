import MiniSearch from "minisearch";
import { foldText } from "$lib/domain/street-name";
import type { StreetRecord } from "$lib/domain/snapshot";

/** Common Italian odonym abbreviations typed by users → canonical words. */
const ABBREVIATIONS: Record<string, string> = {
	v: "via",
	vle: "viale",
	"v.le": "viale",
	p: "piazza",
	pza: "piazza",
	pzza: "piazza",
	"p.za": "piazza",
	"p.zza": "piazza",
	p_za: "piazza",
	pzle: "piazzale",
	"p.le": "piazzale",
	"p.tta": "piazzetta",
	lgo: "largo",
	"l.go": "largo",
	lgarno: "lungarno",
	"l.no": "lungarno",
	lung: "lungarno",
	bgo: "borgo",
	"b.go": "borgo",
	c: "corso",
	"c.so": "corso",
	s: "san",
	"ss.": "santissima",
	ss: "santissima",
	"v.lo": "vicolo",
};

/** Particles that carry no meaning for matching ("via DEL perugino"). */
const STOP_WORDS = new Set([
	"di",
	"del",
	"della",
	"delle",
	"dei",
	"degli",
	"dell",
	"d",
	"da",
	"dal",
	"dalla",
	"a",
	"al",
	"alla",
	"e",
	"la",
	"le",
	"il",
	"lo",
	"l",
	"i",
	"gli",
]);

const ODONYM_TYPES = new Set([
	"via",
	"viale",
	"piazza",
	"piazzale",
	"piazzetta",
	"largo",
	"lungarno",
	"borgo",
	"corso",
	"vicolo",
	"viuzzo",
	"costa",
	"volta",
	"varco",
	"sdrucciolo",
	"vialetto",
	"stradone",
	"pratello",
]);

function tokenize(text: string): string[] {
	return foldText(text)
		.replace(/[’`]/g, "'")
		.split(/[\s'\-,/]+/)
		.filter(Boolean);
}

function processTerm(term: string): string | null {
	const t =
		ABBREVIATIONS[term] ??
		ABBREVIATIONS[term.replace(/\.$/, "")] ??
		term.replace(/\./g, "");
	return t && !STOP_WORDS.has(t) ? t : null;
}

interface IndexedStreet {
	id: number;
	/** Distinctive part of the name ("perugino" for "Via del Perugino"). */
	core: string;
	type: string;
}

export interface StreetMatch {
	street: number;
	score: number;
}

/**
 * Full-text street search with prefix + fuzzy matching and Italian-aware
 * normalisation (accents, abbreviations, particles). The distinctive part of
 * the name is boosted over the odonym type so "perugino" ranks "Via del
 * Perugino" first and "via" alone doesn't flood the results.
 */
export class StreetSearch {
	private readonly index: MiniSearch<IndexedStreet>;

	constructor(private readonly streets: readonly StreetRecord[]) {
		this.index = new MiniSearch<IndexedStreet>({
			fields: ["core", "type"],
			storeFields: [],
			tokenize,
			processTerm,
			searchOptions: {
				boost: { core: 3 },
				prefix: true,
				fuzzy: (term) =>
					term.length >= 5 ? 0.2 : term.length >= 4 ? 1 : 0,
				combineWith: "AND",
			},
		});
		this.index.addAll(
			streets.map((s, id) => {
				const words = tokenize(s.name);
				const first = words[0] ?? "";
				const hasType = ODONYM_TYPES.has(first);
				return {
					id,
					type: hasType ? first : "",
					core: (hasType ? words.slice(1) : words).join(" "),
				};
			})
		);
	}

	search(query: string, limit: number): StreetMatch[] {
		const q = query.trim();
		if (!q) return [];
		const folded = foldText(q);
		return this.index
			.search(q)
			.map((r) => {
				// Tie-breakers: exact name / prefix of the full name wins.
				const name = foldText(this.streets[r.id]!.name);
				const bonus =
					name === folded ? 100 : name.startsWith(folded) ? 10 : 0;
				return { street: r.id as number, score: r.score + bonus };
			})
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);
	}
}
