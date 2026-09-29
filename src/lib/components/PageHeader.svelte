<script lang="ts">
	import { usePreferences } from "$lib/client/preferences.svelte";
	import BrandMark from "./BrandMark.svelte";
	import Icon from "./Icon.svelte";
	import SettingsMenu from "./SettingsMenu.svelte";

	/** Header for content pages (info, privacy): brand, back to the map, settings. */
	const prefs = usePreferences();
	const m = $derived(prefs.m);
</script>

<header class="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
	<div
		class="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4"
	>
		<a href="/" class="flex items-center gap-2.5">
			<BrandMark />
			<span class="leading-tight">
				<span class="block font-serif text-lg font-semibold"
					>{m.common.appName}</span
				>
				<span
					class="block text-xs font-medium tracking-wide text-muted uppercase"
					>{m.common.city} · {m.common.tagline}</span
				>
			</span>
		</a>
		<div class="flex items-center gap-2">
			<a href="/" class="btn-ghost"
				><Icon name="map" size={18} /><span class="max-sm:sr-only"
					>{m.common.back}</span
				></a
			>
			<SettingsMenu />
		</div>
	</div>
</header>
