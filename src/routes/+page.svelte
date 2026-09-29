<script lang="ts">
	import { onMount } from 'svelte';
	import { provideAppState } from '$lib/client/app-state.svelte';
	import { fullBleed } from '$lib/client/full-bleed';
	import { sheetBackdrop } from '$lib/client/sheet-backdrop';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import CityMap from '$lib/components/CityMap.svelte';
	import BottomBar from '$lib/components/BottomBar.svelte';
	import MapFilters from '$lib/components/MapFilters.svelte';
	import MapLegend from '$lib/components/MapLegend.svelte';
	import SettingsMenu from '$lib/components/SettingsMenu.svelte';
	import StreetSheet from '$lib/components/StreetSheet.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { LOCALES } from '$lib/i18n';
	import { SITE_NAME, streetPath } from '$lib/seo';

	let { data } = $props();

	const app = provideAppState();
	const prefs = usePreferences();

	onMount(() => {
		const stop = app.clock.start();
		const params = new URLSearchParams(window.location.search);
		const slug = params.get('strada');
		if (slug) void app.selectStreet(slug, params.get('tratto'));		return stop;
	});
</script>

<!-- With a street open, the canonical page is its crawlable schedule page. -->
<Seo
	title={app.selected ? `${app.selected.name} · ${prefs.m.meta.title}` : prefs.m.meta.title}
	description={prefs.m.meta.description}
	origin={data.origin}
	path={app.selected ? streetPath(app.selected.slug) : '/'}
	jsonLd={[
		{ '@type': 'WebSite', '@id': `${data.origin}/#website`, name: SITE_NAME, alternateName: prefs.m.meta.title, url: `${data.origin}/`, inLanguage: LOCALES },
		{
			'@type': 'WebApplication',
			name: SITE_NAME,
			url: `${data.origin}/`,
			description: prefs.m.meta.description,
			applicationCategory: 'UtilitiesApplication',
			operatingSystem: 'Web',
			browserRequirements: 'Requires JavaScript',
			inLanguage: LOCALES,
			isAccessibleForFree: true,
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
			featureList: prefs.m.seo.appFeatures,
			areaServed: { '@type': 'City', name: 'Firenze', sameAs: 'https://www.wikidata.org/wiki/Q2044' }
		}
	]}
/>

<svelte:head>
	<link rel="preconnect" href="https://tiles.openfreemap.org" crossorigin="anonymous" />
</svelte:head>

<!--
	Full bleed (see full-bleed.ts): on phones the stage extends past the visible
	viewport so the map shows under Safari's status bar and toolbar; the controls
	live in the `viewport` layer, which matches the visible area and keeps clear of
	the safe areas. The black stage shows around the page when it recedes behind a
	raised sheet. No fixed backgrounds touch the edges: Safari would tint its bars.
-->
<div class="stage bg-black" {@attach fullBleed}>
	<main id="main" class="sheet-backdrop absolute inset-0 overflow-hidden" {@attach sheetBackdrop}>
		<h1 class="sr-only">{prefs.m.meta.title}</h1>
		<CityMap />

		<div class="pointer-events-none absolute inset-x-0 top-(--under-status) z-20 h-dvh">
			<!-- Top: brand (left) · filters, legend, settings (right) -->
			<div class="absolute inset-x-0 top-0 flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
				<a href="/" class="glass pointer-events-auto grid size-11 shrink-0 place-items-center max-sm:hidden" aria-label={prefs.m.common.home} title="{prefs.m.common.appName} · {prefs.m.common.city}">
					<BrandMark size={28} />
				</a>
				<div class="pointer-events-auto flex min-w-0 flex-1 items-start justify-end gap-2">
					<div class="min-w-0 max-sm:flex-1"><MapFilters /></div>
					<MapLegend />
					<SettingsMenu />
				</div>
			</div>
		</div>
	</main>
</div>
<!-- Bottom centre: search + my location. Outside the page, fixed: the keyboard lifts it natively. -->
<BottomBar />
<!-- Outside the page: sheets are neither scaled nor dimmed with it, and stay reachable while it is inert. -->
<StreetSheet />
<!-- Eases Safari's bottom bar tint from the sheet colour back to the map (see .bar-tint). -->
<div class="bar-tint" data-on={app.sheetOpen || undefined} aria-hidden="true"></div>

<div class="sr-only" role="status" aria-live="polite">{app.announcement}</div>
