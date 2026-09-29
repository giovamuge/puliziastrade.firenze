<script lang="ts">
	import type { CleaningWindowDto } from "$lib/api/contracts";
	import { useAppState } from "$lib/client/app-state.svelte";
	import { TONE_CLASSES, windowStatus } from "$lib/client/format";
	import { usePreferences } from "$lib/client/preferences.svelte";
	import { formatMinutes, parseIsoDate } from "$lib/domain/civil-date";
	import Icon from "./Icon.svelte";

	/**
	 * "When is the next sweep?" at a glance, in one card: the calendar leaf beside
	 * the title with how far away it is and the time window in large type, then
	 * what to do with the car. The stretch is not repeated here: the sheet
	 * header already names it. While a sweep is in progress a bar shows how much is left.
	 */
	let { window: slot }: { window: CleaningWindowDto | null } = $props();
	const app = useAppState();
	const prefs = usePreferences();
	const uid = $props.id();

	const status = $derived(windowStatus(slot, app.clock.now, prefs.f));
	const day = $derived(slot ? parseIsoDate(slot.date) : -1);
	/** Calendar leaf: weekday, day and month, as on a tear-off calendar. */
	const leaf = $derived(
		day < 0
			? null
			: {
					weekday: new Intl.DateTimeFormat(prefs.locale, {
						weekday: "short",
						timeZone: "UTC",
					}).format(day * 86_400_000),
					date: new Intl.DateTimeFormat(prefs.locale, {
						day: "numeric",
						timeZone: "UTC",
					}).format(day * 86_400_000),
					month: new Intl.DateTimeFormat(prefs.locale, {
						month: "short",
						timeZone: "UTC",
					}).format(day * 86_400_000),
				}
	);
	const time = $derived(
		slot
			? status.tone === "now"
				? prefs.m.status.until(formatMinutes(slot.end))
				: prefs.f.timeWindow(slot.from, slot.to)
			: null
	);
	const progress = $derived(
		status.tone === "now" && slot
			? Math.min(
					100,
					Math.max(
						0,
						((app.clock.now.minute - slot.from) /
							(slot.end - slot.from)) *
							100
					)
				)
			: null
	);
</script>

<section
	class="overflow-hidden rounded-3xl {TONE_CLASSES[status.tone]}"
	aria-labelledby="{uid}-title"
	aria-live="polite"
	aria-atomic="true"
>
	<div class="flex items-center gap-4 p-4">
		{#if leaf}
			<div
				class="flex w-[4.5rem] shrink-0 flex-col overflow-hidden rounded-2xl bg-surface text-center text-text shadow-sm"
				aria-hidden="true"
			>
				<span
					class="bg-primary py-1 text-[0.7rem] font-bold tracking-wider text-on-primary uppercase"
					>{leaf.weekday}</span
				>
				<span class="text-4xl leading-tight font-semibold tabular-nums"
					>{leaf.date}</span
				>
				<span class="pb-1.5 text-xs font-semibold text-muted uppercase"
					>{leaf.month}</span
				>
			</div>
		{/if}
		<!-- One group beside the leaf: title and how far away it is, then the time window filling the width. -->
		<div class="@container min-w-0 flex-1">
			<div
				class="flex flex-wrap place-content-between items-center gap-x-2 gap-y-1"
			>
				<h3 id="{uid}-title" class="text-sm font-semibold opacity-80">
					{prefs.m.status.nextTitle}
				</h3>
				{#if slot}<span
						class="rounded-full bg-black/10 px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap"
						>{status.badge}</span
					>{/if}
			</div>
			{#if slot && time}
				<p
					class="mt-1.5 leading-none font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums"
					style:font-size="min(3.5rem, calc(100cqi / {(
						time.length * 0.56
					).toFixed(2)}))"
				>
					{time}
				</p>
				<p class="sr-only">{status.headline}</p>
			{:else}
				<p class="mt-1 text-2xl leading-tight font-semibold">
					{status.badge}
				</p>
			{/if}
		</div>
	</div>

	{#if progress !== null}
		<div
			class="mx-4 mb-3 h-2 overflow-hidden rounded-full bg-black/20"
			role="progressbar"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={Math.round(progress)}
			aria-label={status.headline}
		>
			<div
				class="h-full rounded-full bg-current"
				style:width="{progress}%"
			></div>
		</div>
	{/if}

	<p class="flex items-start gap-2 bg-black/10 px-4 py-2.5 text-sm">
		<Icon name="car" size={18} class="mt-0.5 shrink-0" />{status.advice}
	</p>
</section>
