<script lang="ts">
	import { usePreferences, type ThemePreference } from '$lib/client/preferences.svelte';
	import { LOCALES, LOCALE_NAMES, isLocale } from '$lib/i18n';
	import Icon from './Icon.svelte';

	/** Theme + language settings in a native popover (light-dismiss, Esc, top layer). */
	const prefs = usePreferences();
	const uid = $props.id();
	const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
</script>

<button type="button" class="glass text-text grid size-11 place-items-center" popovertarget="{uid}-settings" aria-label={prefs.m.settings.open} title={prefs.m.settings.title}>
	<Icon name="settings" />
</button>

<div id="{uid}-settings" popover class="glass fixed top-16 right-3 left-auto w-72 max-w-[calc(100vw-1.5rem)] space-y-4 p-4 max-sm:top-auto max-sm:right-2 max-sm:bottom-2 max-sm:left-2 max-sm:w-auto" aria-labelledby="{uid}-title">
	<h2 id="{uid}-title" class="font-sans text-sm font-bold">{prefs.m.settings.title}</h2>
	<fieldset>
		<legend class="text-muted mb-1.5 text-xs font-semibold tracking-wide uppercase">{prefs.m.settings.theme}</legend>
		<div class="bg-surface-2 grid grid-cols-3 gap-1 rounded-xl p-1">
			{#each THEMES as theme (theme)}
				<label class="has-checked:bg-surface has-checked:text-text text-muted has-focus-visible:outline-accent grid min-h-10 cursor-pointer place-items-center rounded-lg text-sm font-semibold has-checked:shadow-sm has-focus-visible:outline-2">
					<input type="radio" class="sr-only" name="{uid}-theme" value={theme} checked={prefs.themePreference === theme} onchange={() => prefs.setTheme(theme)} />
					{prefs.m.settings[theme]}
				</label>
			{/each}
		</div>
	</fieldset>
	<div>
		<label for="{uid}-lang" class="text-muted mb-1.5 block text-xs font-semibold tracking-wide uppercase">{prefs.m.settings.language}</label>
		<select
			id="{uid}-lang"
			class="bg-surface border-border h-11 w-full rounded-lg border px-2 text-sm"
			value={prefs.localePreference ?? ''}
			onchange={(e) => prefs.setLocale(isLocale(e.currentTarget.value) ? e.currentTarget.value : null)}
		>
			<option value="">{prefs.m.settings.system} ({LOCALE_NAMES[prefs.systemLocale]})</option>
			{#each LOCALES as locale (locale)}
				<option value={locale} lang={locale}>{LOCALE_NAMES[locale]}</option>
			{/each}
		</select>
	</div>
	<nav class="border-border -mx-1 border-t pt-2" aria-label={prefs.m.common.info}>
		<a href="/strade" class="btn-ghost w-full justify-start"><Icon name="list" size={18} />{prefs.m.seo.allStreets}</a>
		<a href="/info" class="btn-ghost w-full justify-start"><Icon name="info" size={18} />{prefs.m.common.info}</a>
		<a href="/privacy" class="btn-ghost w-full justify-start"><Icon name="check" size={18} />{prefs.m.common.privacy}</a>
	</nav>
</div>
