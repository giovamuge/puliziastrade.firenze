<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { providePreferences } from '$lib/client/preferences.svelte';
	import { isLocale } from '$lib/i18n';

	let { children } = $props();

	// Server-rendered pages pass their locale; the prerendered home starts in the default one.
	const initial = page.data.locale;
	const prefs = providePreferences(isLocale(initial) ? initial : undefined);

	onMount(() => prefs.init());
	$effect(() => prefs.apply());
</script>

<a href="#main" class="bg-primary text-on-primary sr-only z-50 rounded-lg px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
	{prefs.m.common.skip}
</a>

{@render children()}
