<script lang="ts">
	import { usePreferences } from '$lib/client/preferences.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { clampDescription } from '$lib/seo';
	import { parseIsoDate } from '$lib/domain/civil-date';
	import { PRIVACY_UPDATED_AT } from '$lib/site';

	let { data } = $props();
	const prefs = usePreferences();
	const p = $derived(prefs.m.privacy);
</script>

<Seo title={p.metaTitle} description={clampDescription(p.intro)} origin={data.origin} path="/privacy" />

<PageHeader />

<main id="main" class="mx-auto max-w-3xl space-y-8 px-4 py-8">
	<header class="space-y-2">
		<h1 class="text-3xl font-semibold">{p.title}</h1>
		<p class="text-muted">{p.intro}</p>
	</header>

	<section aria-labelledby="controller" class="space-y-2">
		<h2 id="controller" class="text-2xl font-semibold">{p.controllerTitle}</h2>
		{#if data.owner}
			<p class="text-sm">{data.owner.name} · <a class="text-primary-text underline" href="mailto:{data.owner.email}">{data.owner.email}</a></p>
		{:else}
			<p class="text-sm">{p.controllerMissing}</p>
		{/if}
	</section>

	<section aria-labelledby="data" class="space-y-3">
		<h2 id="data" class="text-2xl font-semibold">{p.dataTitle}</h2>
		<dl class="card divide-border divide-y text-sm">
			{#each p.data as [title, text] (title)}
				<div class="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]">
					<dt class="font-semibold">{title}</dt>
					<dd>{text}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section id="cookie" aria-labelledby="cookies" class="scroll-mt-20 space-y-2">
		<h2 id="cookies" class="text-2xl font-semibold">{p.cookiesTitle}</h2>
		<p class="text-sm">{p.cookies}</p>
		<ul class="list-disc space-y-1 pl-5 text-sm">
			{#each p.storage as item (item)}<li>{item}</li>{/each}
		</ul>
	</section>

	<section aria-labelledby="third" class="space-y-2">
		<h2 id="third" class="text-2xl font-semibold">{p.thirdTitle}</h2>
		<ul class="list-disc space-y-1 pl-5 text-sm">
			{#each p.third as item (item)}<li>{item}</li>{/each}
		</ul>
	</section>

	<section aria-labelledby="rights" class="space-y-2">
		<h2 id="rights" class="text-2xl font-semibold">{p.rightsTitle}</h2>
		<p class="text-sm">{p.rights}</p>
	</section>

	<p class="text-muted text-xs">{p.updated(prefs.f.longDate(parseIsoDate(PRIVACY_UPDATED_AT)))}</p>
</main>
