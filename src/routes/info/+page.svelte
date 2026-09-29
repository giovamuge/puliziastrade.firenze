<script lang="ts">
	import { usePreferences } from "$lib/client/preferences.svelte";
	import PageHeader from "$lib/components/PageHeader.svelte";
	import Seo from "$lib/components/Seo.svelte";
	import { breadcrumbLd, clampDescription } from "$lib/seo";
	import { parseIsoDate } from "$lib/domain/civil-date";
	import { OFFICIAL_CHANNELS } from "$lib/site";

	let { data } = $props();
	const prefs = usePreferences();
	const m = $derived(prefs.m);
	const f = $derived(prefs.f);
	const meta = $derived(data.meta);
	const max = $derived(Math.max(1, ...meta.weekdayBand.flat()));
	const counts = $derived([
		[m.info.counts.streets, meta.counts.streets],
		[m.info.counts.segments, meta.counts.segments],
		[m.info.counts.features, meta.counts.features],
		[m.info.counts.rules, meta.counts.rules],
	] as const);
	const source = $derived([
		[
			m.info.source.dataset,
			`${meta.source.title} (${meta.source.identifier || meta.source.datasetId})`,
		],
		[
			m.info.source.owner,
			`${meta.source.author} · ${meta.source.maintainerEmail}`,
		],
		[m.info.source.provider, "Alia Servizi Ambientali S.p.A."],
		[m.info.source.license, meta.source.licenseTitle],
		[
			m.info.source.themes,
			[...meta.source.themes, ...meta.source.tags].join(", "),
		],
		[
			m.info.source.resource,
			`${meta.source.resourceName} · ${meta.source.resourceFormat}`,
		],
		[m.info.source.crs, meta.source.crs ?? m.info.notAvailable],
		[
			m.info.source.metadataModified,
			f.dateTime(meta.source.resourceModifiedAt),
		],
		[m.info.source.fileGenerated, f.dateTime(meta.source.fileGeneratedAt)],
		[m.info.source.fileModified, f.dateTime(meta.source.fileLastModified)],
		[m.info.source.lastImport, f.dateTime(meta.refreshedAt)],
		[m.info.source.version, meta.version],
	] as const);
</script>

<Seo
	title={m.meta.infoTitle}
	description={clampDescription(m.info.intro)}
	origin={data.origin}
	path="/info"
	jsonLd={[
		breadcrumbLd(data.origin, [
			[m.seo.map, "/"],
			[m.info.title, "/info"],
		]),
		{
			"@type": "Dataset",
			name: meta.source.title,
			description: m.info.intro,
			url: meta.source.landingPageUrl,
			license: meta.source.licenseUrl,
			creator: { "@type": "Organization", name: meta.source.author },
			dateModified: meta.source.resourceModifiedAt ?? meta.refreshedAt,
			spatialCoverage: { "@type": "Place", name: "Firenze, Italia" },
			isAccessibleForFree: true,
		},
	]}
/>

<PageHeader />

<main id="main" class="mx-auto max-w-3xl space-y-10 px-4 py-8">
	<header class="space-y-2">
		<h1 class="text-3xl font-semibold">{m.info.title}</h1>
		<p class="text-muted">{m.info.intro}</p>
	</header>

	<section
		id="avvertenze"
		aria-labelledby="disclaimer"
		class="scroll-mt-20 space-y-2 rounded-2xl border-l-4 border-primary pl-4"
	>
		<h2 id="disclaimer" class="text-2xl font-semibold">
			{m.info.disclaimerTitle}
		</h2>
		<ul class="list-disc space-y-1 pl-5 text-sm">
			{#each m.info.disclaimer as item (item)}<li>{item}</li>{/each}
		</ul>
	</section>

	<section aria-labelledby="numbers" class="space-y-4">
		<h2 id="numbers" class="text-2xl font-semibold">{m.info.numbers}</h2>
		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each counts as [label, value] (label)}
				<div class="card p-4">
					<dt
						class="text-xs font-semibold tracking-wide text-muted uppercase"
					>
						{label}
					</dt>
					<dd
						class="mt-1 font-serif text-3xl font-semibold tabular-nums"
					>
						{f.number(value)}
					</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section aria-labelledby="week" class="space-y-3">
		<h2 id="week" class="text-2xl font-semibold">{m.info.weekTitle}</h2>
		<p class="text-sm text-muted">{m.info.weekIntro}</p>
		<div class="overflow-x-auto">
			<table
				class="w-full min-w-[28rem] border-separate border-spacing-1 text-sm"
			>
				<caption class="sr-only">{m.info.weekCaption}</caption>
				<thead>
					<tr>
						<td></td>
						{#each m.map.bands.slice(0, 3) as label (label)}<th
								scope="col"
								class="px-2 py-1 text-left text-xs font-semibold text-muted"
								>{label}</th
							>{/each}
					</tr>
				</thead>
				<tbody>
					{#each meta.weekdayBand as row, d (d)}
						<tr>
							<th
								scope="row"
								class="pr-2 text-left font-medium capitalize"
								>{f.weekday(d)}</th
							>
							{#each row as value, b (b)}
								{@const ratio = value / max}
								<td
									class="rounded-lg px-3 py-2 text-right tabular-nums {ratio >
									0.55
										? 'text-white'
										: ''}"
									style:background-color="color-mix(in oklab,
									var(--c-primary) {Math.round(ratio * 100)}%,
									var(--c-surface-2))"
								>
									{f.number(value)}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section aria-labelledby="source" class="space-y-3">
		<h2 id="source" class="text-2xl font-semibold">{m.info.sourceTitle}</h2>
		<dl class="divide-y divide-border card text-sm">
			{#each source as [label, value] (label)}
				<div class="grid gap-1 px-4 py-2.5 sm:grid-cols-[12rem_1fr]">
					<dt class="text-muted">{label}</dt>
					<dd class="break-words">{value}</dd>
				</div>
			{/each}
		</dl>
		<p class="text-sm">
			<a
				class="text-primary-text underline"
				href={meta.source.landingPageUrl}
				rel="noopener">{m.info.datasetLink}</a
			>
			·
			<a
				class="text-primary-text underline"
				href={meta.source.licenseUrl}
				rel="license noopener">{m.info.licenseLink}</a
			>
		</p>
		<p class="text-sm text-muted">
			{m.info.refresh}
			{#if meta.counts.issues > 0}{m.info.issues(meta.counts.issues)}{/if}
		</p>
	</section>

	<section aria-labelledby="rules" class="space-y-2">
		<h2 id="rules" class="text-2xl font-semibold">{m.info.rulesTitle}</h2>
		<ul class="list-disc space-y-1 pl-5 text-sm">
			{#each m.info.rules as rule (rule)}<li>{rule}</li>{/each}
		</ul>
	</section>

	<section aria-labelledby="contacts" class="space-y-3">
		<h2 id="contacts" class="text-2xl font-semibold">
			{m.info.contactsTitle}
		</h2>
		<p class="text-sm">{m.info.contactsIntro}</p>
		<ul class="grid gap-3 text-sm sm:grid-cols-2">
			<li class="space-y-1 card p-4">
				<p class="font-semibold">{OFFICIAL_CHANNELS.alia.name}</p>
				<p>
					<a
						class="text-primary-text underline"
						href="tel:{OFFICIAL_CHANNELS.alia.phoneLandline.replace(
							/\s/g,
							''
						)}"
						>{m.reviews.callLandline(
							OFFICIAL_CHANNELS.alia.phoneLandline
						)}</a
					>
				</p>
				<p>
					<a
						class="text-primary-text underline"
						href="tel:{OFFICIAL_CHANNELS.alia.phoneMobile.replace(
							/\s/g,
							''
						)}"
						>{m.reviews.callMobile(
							OFFICIAL_CHANNELS.alia.phoneMobile
						)}</a
					>
				</p>
				<p class="text-muted">{OFFICIAL_CHANNELS.alia.hours}</p>
				<p>
					<a
						class="text-primary-text underline"
						href={OFFICIAL_CHANNELS.alia.url}
						rel="noopener">{m.reviews.openForm}</a
					>
				</p>
			</li>
			<li class="space-y-1 card p-4">
				<p class="font-semibold">{OFFICIAL_CHANNELS.comune.name}</p>
				<p>
					<a
						class="text-primary-text underline"
						href="tel:{OFFICIAL_CHANNELS.comune.phone.replace(
							/\s/g,
							''
						)}">{OFFICIAL_CHANNELS.comune.phone}</a
					>
				</p>
				<p>
					<a
						class="text-primary-text underline"
						href={OFFICIAL_CHANNELS.comune.url}
						rel="noopener">{m.reviews.openForm}</a
					>
				</p>
			</li>
		</ul>
		<p class="text-xs text-muted">
			{m.info.verifiedAt(
				f.longDate(parseIsoDate(OFFICIAL_CHANNELS.verifiedAt))
			)}
		</p>
	</section>

	<section aria-labelledby="privacy" class="space-y-2">
		<h2 id="privacy" class="text-2xl font-semibold">
			{m.info.privacyTitle}
		</h2>
		<p class="text-sm">{m.info.privacy}</p>
		<p class="text-sm">
			<a class="text-primary-text underline" href="/privacy"
				>{m.common.privacy}</a
			>
		</p>
	</section>

	<section aria-labelledby="a11y" class="space-y-2">
		<h2 id="a11y" class="text-2xl font-semibold">{m.info.a11yTitle}</h2>
		<p class="text-sm">{m.info.a11y}</p>
	</section>

	<section aria-labelledby="credits" class="space-y-2">
		<h2 id="credits" class="text-2xl font-semibold">
			{m.info.creditsTitle}
		</h2>
		<p class="text-sm">{m.info.credits}</p>
	</section>
</main>
