<script lang="ts">
	import { useAppState } from "$lib/client/app-state.svelte";
	import { usePreferences } from "$lib/client/preferences.svelte";
	import { useStreetModel } from "$lib/client/street-model.svelte";
	import { parseIsoDate } from "$lib/domain/civil-date";
	import { api } from "$lib/client/api";
	import { groupColor } from "$lib/client/map-style";
	import CleaningHero from "./CleaningHero.svelte";
	import DayStrip from "./DayStrip.svelte";
	import Icon from "./Icon.svelte";
	import NavRow from "./NavRow.svelte";

	/** First screen of the street sheet: the answer, two weeks ahead, and links to details. */
	const app = useAppState();
	const prefs = usePreferences();
	const model = useStreetModel();
	const m = $derived(prefs.m);
	const f = $derived(prefs.f);
	const street = $derived(model.street!);

	const ruleSummary = $derived(
		(model.focus >= 0
			? (street.groups[model.focus]?.rules ?? street.rules)
			: street.rules
		)
			.map((r) => f.rule(r))
			.join(" · ")
	);
	const upcomingSummary = $derived(
		model.focusUpcoming
			.slice(0, 3)
			.map((o) => f.shortDate(parseIsoDate(o.date)))
			.join(" · ")
	);

	// Community signal: people reporting that the street sign differs from the open data.
	let signMismatch = $state(0);
	$effect(() => {
		const controller = new AbortController();
		signMismatch = 0;
		api.reviews(street.slug, controller.signal).then(
			(r) => (signMismatch = r.aggregate.signMismatch ?? 0),
			() => {}
		);
		return () => controller.abort();
	});

	const dataDate = $derived(
		street.dataUpdatedAt
			? new Intl.DateTimeFormat(prefs.locale, {
					dateStyle: "long",
					timeZone: "Europe/Rome",
				}).format(new Date(street.dataUpdatedAt))
			: null
	);

	let copied = $state(false);
	async function share(): Promise<void> {
		const url = window.location.href;
		if (navigator.share) {
			await navigator.share({ title: street.name, url }).catch(() => {});
			return;
		}
		await navigator.clipboard.writeText(url);
		copied = true;
		app.announce(m.common.linkCopied);
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="space-y-5 pt-1">
	{#if app.unmappedTap}
		<p
			class="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-sm"
			role="note"
		>
			<Icon
				name="info"
				size={18}
				class="mt-0.5 shrink-0 text-primary-text"
			/>{m.map.unmappedTap(street.name)}
		</p>
	{/if}

	{#if model.lastDone}
		{@const time = f.timeWindow(
			model.lastDone.occurrence.from,
			model.lastDone.occurrence.to
		)}
		<!-- Low-priority prompt: the data says a sweep was scheduled, not that it happened. -->
		<button
			type="button"
			class="flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-left text-xs text-muted hover:text-text"
			onclick={() => (app.view = "verify")}
		>
			<Icon name="chat" size={14} class="shrink-0" />
			<span class="min-w-0 flex-1 truncate">
				{model.lastDone.ago === 0
					? m.reviews.promptToday(time)
					: m.reviews.promptYesterday(time)}{model.lastDone.scope
					? ` · ${model.lastDone.scope}`
					: ""}
			</span>
			<span class="shrink-0 font-semibold text-primary-text"
				>{m.reviews.promptCta} ›</span
			>
		</button>
	{/if}

	<CleaningHero window={model.next} />

	{#if signMismatch > 0}
		<p
			class="flex items-start gap-2 rounded-2xl bg-tone-tomorrow p-3 text-sm text-tone-tomorrow-fg"
			role="note"
		>
			<Icon
				name="info"
				size={18}
				class="mt-0.5 shrink-0"
			/>{m.street.signWarning(signMismatch)}
		</p>
	{/if}

	<DayStrip
		occurrences={model.focusUpcoming}
		done={model.lastDone?.ago === 0 ? model.lastDone.occurrence : null}
	/>

	<ul class="divide-y divide-border overflow-hidden card">
		<!-- One entry for the schedules: with several stretches, the dots show them (the chosen one ringed). -->
		<NavRow
			icon="calendar"
			title={m.street.views.schedule}
			subtitle={ruleSummary}
			onclick={() => (app.view = "schedule")}
		>
			{#snippet trailing()}
				{#if model.multiGroup}
					<span class="flex gap-1" aria-hidden="true">
						{#each street.groups as _, i (i)}
							<span
								class="size-3 rounded-full {model.focus === i
									? 'ring-2 ring-text ring-offset-1 ring-offset-transparent'
									: ''}"
								style:background-color={groupColor(
									prefs.theme,
									i
								)}
							></span>
						{/each}
					</span>
				{/if}
			{/snippet}
		</NavRow>
		<NavRow
			icon="broom"
			title={m.street.views.upcoming}
			subtitle={upcomingSummary || m.street.noUpcoming}
			onclick={() => (app.view = "upcoming")}
		/>
		{#if app.nearby && app.nearby.items.length > 1}
			<NavRow
				icon="locate"
				title={m.street.views.nearby}
				subtitle={m.street.nearbyCount(app.nearby.items.length)}
				onclick={() => (app.view = "nearby")}
			/>
		{/if}
		<NavRow
			icon="info"
			title={m.street.views.technical}
			subtitle={`${street.rawName} · ${m.street.segments(street.segmentCount)}`}
			onclick={() => (app.view = "technical")}
		/>
	</ul>

	<button type="button" class="btn-secondary w-full" onclick={share}>
		<Icon name={copied ? "check" : "share"} size={18} />{copied
			? m.common.copied
			: m.common.share}
	</button>

	<p class="text-xs text-muted">
		{#if dataDate}{m.street.sourceLine(dataDate)}{/if}
		<a href="/info#avvertenze" class="underline">{m.street.sourceMore}</a>
	</p>
</div>
