<script lang="ts">
	import { api } from '$lib/client/api';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { parseIsoDate } from '$lib/domain/civil-date';
	import { breadcrumbLd, clampDescription, mapPath, streetPath } from '$lib/seo';

	let { data } = $props();
	const prefs = usePreferences();
	const m = $derived(prefs.m);
	const f = $derived(prefs.f);
	const street = $derived(data.street);
	const path = $derived(streetPath(street.slug));
	const multiGroup = $derived(street.groups.length > 1);
	const ruleSummary = $derived(street.rules.map((r) => f.rule(r)).map((t) => t.charAt(0).toLocaleLowerCase(prefs.locale) + t.slice(1)).join('; '));
	const next = $derived(street.upcoming[0]);
	const calendarUrl = $derived(api.calendarPath(street.slug, { alarm: 'auto', lang: prefs.locale }));
</script>

<Seo
	title={m.seo.streetTitle(street.name)}
	description={clampDescription(m.seo.streetDescription(street.name, ruleSummary))}
	origin={data.origin}
	{path}
	jsonLd={[
		breadcrumbLd(data.origin, [
			[m.seo.map, '/'],
			[m.seo.allStreets, '/strade'],
			[street.name, path]
		]),
		{
			'@type': 'WebPage',
			'@id': data.origin + path,
			name: m.seo.streetTitle(street.name),
			url: data.origin + path,
			inLanguage: prefs.locale,
			isPartOf: { '@id': `${data.origin}/#website` },
			dateModified: street.dataUpdatedAt ?? undefined,
			about: {
				'@type': 'Place',
				name: `${street.name}, Firenze`,
				address: { '@type': 'PostalAddress', streetAddress: street.name, addressLocality: 'Firenze', addressRegion: 'FI', addressCountry: 'IT' },
				geo: { '@type': 'GeoCoordinates', latitude: +street.center.lat.toFixed(5), longitude: +street.center.lon.toFixed(5) }
			}
		}
	]}
/>

<PageHeader />

<main id="main" class="mx-auto max-w-3xl space-y-8 px-4 py-8">
	<nav aria-label={m.seo.breadcrumb} class="text-muted text-sm">
		<ol class="flex flex-wrap gap-1.5">
			<li><a class="text-primary-text underline" href="/">{m.seo.map}</a> <span aria-hidden="true">›</span></li>
			<li><a class="text-primary-text underline" href="/strade">{m.seo.allStreets}</a> <span aria-hidden="true">›</span></li>
			<li aria-current="page">{street.name}</li>
		</ol>
	</nav>

	<header class="space-y-3">
		<h1 class="text-3xl font-semibold">{m.seo.streetHeading(street.name)}</h1>
		<p class="text-muted">{m.seo.streetSubtitle}</p>
		{#if next}
			<p class="card flex items-center gap-3 p-4">
				<Icon name="broom" class="text-primary-text shrink-0" />
				<span>
					<span class="text-muted block text-xs font-semibold tracking-wide uppercase">{m.seo.next}</span>
					<span class="font-semibold">{f.longDate(parseIsoDate(next.date), true)}, {f.timeWindow(next.from, next.to)}</span>
				</span>
			</p>
		{/if}
		<div class="flex flex-wrap gap-2">
			<a href={mapPath(street.slug)} class="btn-primary"><Icon name="map" size={18} />{m.seo.openMap}</a>
			<a href={calendarUrl} class="btn-secondary" rel="nofollow"><Icon name="calendar" size={18} />{m.seo.calendar}</a>
		</div>
	</header>

	<section aria-labelledby="orari" class="space-y-3">
		<h2 id="orari" class="text-2xl font-semibold">{m.seo.whenTitle(street.name)}</h2>
		{#if street.sectionCount > 1}<p class="text-muted text-sm">{m.street.sectionsNote(street.sectionCount)}</p>{/if}
		{#if multiGroup}
			<p class="text-muted text-sm">{m.street.schedulesHint}</p>
			<ul class="space-y-2">
				{#each street.groups as group, i (i)}
					<li class="card p-3">
						<h3 class="font-semibold">{f.between(group.between, i)}</h3>
						<p class="text-muted text-xs">{m.street.segments(group.segmentCount)} · {f.distance(group.lengthMeters)}</p>
						<ul class="mt-2 space-y-0.5 text-sm">
							{#each group.rules as rule (rule.weekday + '-' + rule.from)}
								<li class="flex items-start gap-2"><Icon name="calendar" size={16} class="text-primary-text mt-0.5 shrink-0" />{f.rule(rule)}</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="card divide-border divide-y">
				{#each street.rules as rule (rule.weekday + '-' + rule.from)}
					<li class="flex items-start gap-3 p-3"><Icon name="calendar" size={18} class="text-primary-text mt-0.5 shrink-0" />{f.rule(rule)}</li>
				{/each}
			</ul>
		{/if}
		<p class="flex items-start gap-2 text-sm"><Icon name="car" size={18} class="text-primary-text mt-0.5 shrink-0" />{m.ics.noParking}</p>
	</section>

	<section aria-labelledby="passaggi" class="space-y-3">
		<h2 id="passaggi" class="text-2xl font-semibold">{m.seo.upcomingTitle(street.name)}</h2>
		{#if street.upcoming.length}
			<ol class="card divide-border divide-y">
				{#each street.upcoming as o (o.date + o.from)}
					<li class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 p-3">
						<time datetime={o.date} class="font-medium">{f.longDate(parseIsoDate(o.date), true)}</time>
						<span class="text-muted text-sm tabular-nums">
							{f.timeWindow(o.from, o.to)}{#if multiGroup}
								· {o.wholeStreet ? m.street.wholeStreet : f.list(o.groups.map((g) => f.between(street.groups[g]?.between ?? [], g)))}{/if}
						</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="text-muted">{m.street.noUpcoming}</p>
		{/if}
	</section>

	{#if data.neighbours.length}
		<section aria-labelledby="vicine" class="space-y-3">
			<h2 id="vicine" class="text-2xl font-semibold">{m.seo.nearbyTitle}</h2>
			<ul class="flex flex-wrap gap-2">
				{#each data.neighbours as n (n.slug)}
					<li><a class="btn-secondary min-h-10 px-3 font-medium" href={streetPath(n.slug)}>{n.name}</a></li>
				{/each}
			</ul>
		</section>
	{/if}

	<footer class="text-muted border-border space-y-1 border-t pt-4 text-xs">
		<p>{m.street.sourceLine(street.dataUpdatedAt ? f.dateTime(street.dataUpdatedAt) : m.info.notAvailable)}</p>
		<p><a class="text-primary-text underline" href="/info#avvertenze">{m.street.sourceMore}</a> · <a class="text-primary-text underline" href="/strade">{m.seo.allStreets}</a></p>
	</footer>
</main>
