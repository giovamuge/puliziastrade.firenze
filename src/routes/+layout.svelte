<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { providePreferences } from "$lib/client/preferences.svelte";
	import { isLocale } from "$lib/i18n";

	let { children } = $props();

	// Server-rendered pages pass their locale; the prerendered home starts in the default one.
	const initial = page.data.locale;
	const prefs = providePreferences(isLocale(initial) ? initial : undefined);

	onMount(() => {
		prefs.init();
		// iOS Safari only applies :active (the pressed feedback in app.css) when a touchstart listener exists.
		const noop = () => {};
		document.addEventListener("touchstart", noop, { passive: true });
		return () => document.removeEventListener("touchstart", noop);
	});
	$effect(() => prefs.apply());
</script>

<a
	href="#main"
	class="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
>
	{prefs.m.common.skip}
</a>

{@render children()}
