<script lang="ts">
	import type { CleaningWindowDto } from '$lib/api/contracts';
	import { useAppState } from '$lib/client/app-state.svelte';
	import { TONE_CLASSES, windowStatus } from '$lib/client/format';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import { formatMinutes, parseIsoDate } from '$lib/domain/civil-date';
	import Icon from './Icon.svelte';

	/**
	 * "When is the next sweep?" at a glance: a calendar leaf with the date, the
	 * relative moment in large type, the time window, and what to do with the
	 * car. While a sweep is in progress a bar shows how much is left.
	 */
	let { window: slot, scope }: { window: CleaningWindowDto | null; scope: string | null } = $props();
	const app = useAppState();
	const prefs = usePreferences();

	const status = $derived(windowStatus(slot, app.clock.now, prefs.f));
	const day = $derived(slot ? parseIsoDate(slot.date) : -1);
	const leaf = $derived(
		day < 0
			? null
			: {
					weekday: new Intl.DateTimeFormat(prefs.locale, { weekday: 'short', timeZone: 'UTC' }).format(day * 86_400_000),
					date: new Intl.DateTimeFormat(prefs.locale, { day: 'numeric', timeZone: 'UTC' }).format(day * 86_400_000),
					month: new Intl.DateTimeFormat(prefs.locale, { month: 'short', timeZone: 'UTC' }).format(day * 86_400_000)
				}
	);
	const progress = $derived(
		status.tone === 'now' && slot ? Math.min(100, Math.max(0, ((app.clock.now.minute - slot.from) / (slot.end - slot.from)) * 100)) : null
	);
</script>

<section class="overflow-hidden rounded-3xl {TONE_CLASSES[status.tone]}" aria-live="polite" aria-atomic="true">
	<div class="flex items-stretch gap-4 p-4">
		{#if leaf}
			<div class="bg-surface text-text flex w-[4.5rem] shrink-0 flex-col overflow-hidden rounded-2xl text-center shadow-sm" aria-hidden="true">
				<span class="bg-primary text-on-primary py-1 text-[0.7rem] font-bold tracking-wider uppercase">{leaf.weekday}</span>
				<span class="font-serif text-4xl leading-tight font-semibold">{leaf.date}</span>
				<span class="text-muted pb-1.5 text-xs font-semibold uppercase">{leaf.month}</span>
			</div>
		{/if}
		<div class="min-w-0 flex-1">
			<p class="text-xs font-bold tracking-wide uppercase opacity-90">{prefs.m.status.nextTitle}</p>
			<p class="font-serif text-[1.7rem] leading-tight font-semibold">
				{status.badge}
			</p>
			{#if slot}
				<p class="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
					<Icon name="calendar" size={18} class="shrink-0 opacity-80" />
					{#if status.tone === 'now'}{prefs.m.status.until(formatMinutes(slot.end))}{:else}{prefs.f.timeWindow(slot.from, slot.to)}{/if}
				</p>
				<p class="sr-only">{status.headline}</p>
			{/if}
			{#if scope}<p class="mt-1 text-sm font-medium opacity-90">{scope}</p>{/if}
		</div>
	</div>

	{#if progress !== null}
		<div class="mx-4 mb-3 h-2 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)} aria-label={status.headline}>
			<div class="h-full rounded-full bg-current" style:width="{progress}%"></div>
		</div>
	{/if}

	<p class="flex items-start gap-2 bg-black/10 px-4 py-2.5 text-sm font-medium">
		<Icon name="car" size={18} class="mt-0.5 shrink-0" />{status.advice}
	</p>
</section>
