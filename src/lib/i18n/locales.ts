export const LOCALES = ['it', 'en', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'it';

export const LOCALE_NAMES: Record<Locale, string> = {
	it: 'Italiano',
	en: 'English',
	es: 'Español',
	fr: 'Français',
	de: 'Deutsch'
};

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** First supported language in the user's preference list (`navigator.languages`, Accept-Language). */
export function matchLocale(preferences: readonly string[]): Locale {
	for (const tag of preferences) {
		const base = tag.toLowerCase().split(/[-_]/)[0];
		if (isLocale(base)) return base;
	}
	return DEFAULT_LOCALE;
}

/** Parses an `Accept-Language` header into ordered tags. */
export function parseAcceptLanguage(header: string | null): string[] {
	if (!header) return [];
	return header
		.split(',')
		.map((part) => {
			const [tag = '', q] = part.trim().split(';q=');
			return { tag, q: q ? Number(q) : 1 };
		})
		.filter((x) => x.tag && x.q > 0)
		.sort((a, b) => b.q - a.q)
		.map((x) => x.tag);
}
