import { getContext, setContext } from 'svelte';
import { DEFAULT_LOCALE, formatterFor, isLocale, matchLocale, type Formatter, type Locale, type Messages } from '$lib/i18n';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const THEME_KEY = 'theme';
const LOCALE_KEY = 'locale';

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		/* storage unavailable (private mode): preference lasts for the session */
	}
}

/**
 * User preferences: theme and language. Both default to the system settings
 * and can be overridden; overrides are kept in localStorage (never sent to
 * the server, except the locale cookie used to server-render `/info`).
 *
 * The state starts at the defaults used for SSR/prerender and switches to the
 * detected values in `init()` (after hydration), so the markup always matches.
 */
export class Preferences {
	themePreference = $state<ThemePreference>('system');
	systemTheme = $state<Theme>('light');
	readonly theme: Theme = $derived(this.themePreference === 'system' ? this.systemTheme : this.themePreference);

	localePreference = $state<Locale | null>(null);
	systemLocale = $state<Locale>(DEFAULT_LOCALE);
	readonly locale: Locale = $derived(this.localePreference ?? this.systemLocale);
	readonly f: Formatter = $derived(formatterFor(this.locale));
	readonly m: Messages = $derived(this.f.m);

	constructor(initialLocale: Locale = DEFAULT_LOCALE) {
		this.systemLocale = initialLocale;
	}

	/** Client only: read system settings and stored overrides, keep them in sync. */
	init(): () => void {
		const media = matchMedia('(prefers-color-scheme: dark)');
		const onScheme = () => (this.systemTheme = media.matches ? 'dark' : 'light');
		onScheme();
		media.addEventListener('change', onScheme);

		const storedTheme = read(THEME_KEY);
		if (storedTheme === 'light' || storedTheme === 'dark') this.themePreference = storedTheme;
		const storedLocale = read(LOCALE_KEY);
		this.localePreference = isLocale(storedLocale) ? storedLocale : null;
		this.systemLocale = matchLocale(navigator.languages ?? [navigator.language]);

		const onLanguage = () => (this.systemLocale = matchLocale(navigator.languages ?? [navigator.language]));
		window.addEventListener('languagechange', onLanguage);
		return () => {
			media.removeEventListener('change', onScheme);
			window.removeEventListener('languagechange', onLanguage);
		};
	}

	setTheme(preference: ThemePreference): void {
		this.themePreference = preference;
		write(THEME_KEY, preference === 'system' ? null : preference);
	}

	setLocale(locale: Locale | null): void {
		this.localePreference = locale;
		write(LOCALE_KEY, locale);
		document.cookie = locale ? `locale=${locale}; path=/; max-age=31536000; samesite=lax` : 'locale=; path=/; max-age=0';
	}

	/** Mirrors the state onto <html> (lang + data-theme). */
	apply(): void {
		const root = document.documentElement;
		root.lang = this.locale;
		if (this.themePreference === 'system') root.removeAttribute('data-theme');
		else root.dataset.theme = this.themePreference;
		root.dataset.resolvedTheme = this.theme;
	}
}

const KEY = Symbol('preferences');

export function providePreferences(initialLocale?: Locale): Preferences {
	return setContext(KEY, new Preferences(initialLocale));
}

export function usePreferences(): Preferences {
	return getContext<Preferences>(KEY);
}
