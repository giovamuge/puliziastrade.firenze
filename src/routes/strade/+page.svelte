<script lang="ts">
	import { usePreferences } from '$lib/client/preferences.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { breadcrumbLd, streetPath } from '$lib/seo';

	let { data } = $props();
	const prefs = usePreferences();
	const m = $derived(prefs.m.seo);
</script>

<Seo
	title={m.indexTitle}
	description={m.indexDescription(data.count)}
	origin={data.origin}
	path="/strade"
	jsonLd={[
		breadcrumbLd(data.origin, [
			[m.map, '/'],
			[m.allStreets, '/strade']
		]),
		{ '@type': 'CollectionPage', name: m.indexHeading, url: `${data.origin}/strade`, isPartOf: { '@id': `${data.origin}/#website` } }
	]}
/>

<PageHeader />

<main id="main" class="mx-auto max-w-3xl space-y-8 px-4 py-8">
	<nav aria-label={m.breadcrumb} class="text-muted text-sm">
		<ol class="flex flex-wrap gap-1.5">
			<li><a class="text-primary-text underline" href="/">{m.map}</a> <span aria-hidden="true">›</span></li>
			<li aria-current="page">{m.allStreets}</li>
		</ol>
	</nav>

	<header class="space-y-2">
		<h1 class="text-3xl font-semibold">{m.indexHeading}</h1>
		<p class="text-muted">{m.indexIntro(data.count)}</p>
	</header>

	<nav aria-label={m.letters} class="bg-bg/90 border-border sticky top-16 z-30 -mx-4 border-b px-4 py-2 backdrop-blur">
		<ul class="flex flex-wrap gap-1">
			{#each data.letters as { letter } (letter)}
				<li><a href="#lettera-{letter}" class="hover:bg-surface-2 grid size-9 place-items-center rounded-lg font-semibold">{letter}</a></li>
			{/each}
		</ul>
	</nav>

	{#each data.letters as { letter, streets } (letter)}
		<section id="lettera-{letter}" aria-labelledby="h-{letter}" class="scroll-mt-32 space-y-2">
			<h2 id="h-{letter}" class="font-serif text-2xl font-semibold">{letter}</h2>
			<ul class="grid gap-x-6 gap-y-1 sm:grid-cols-2">
				{#each streets as street (street.slug)}
					<li><a class="hover:text-primary-text block py-1 underline-offset-2 hover:underline" href={streetPath(street.slug)}>{street.name}</a></li>
				{/each}
			</ul>
		</section>
	{/each}
</main>
