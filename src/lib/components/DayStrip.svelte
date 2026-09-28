<script lang="ts">
	import type { OccurrenceDto } from '$lib/api/contracts';
	import { useAppState } from '$lib/client/app-state.svelte';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import { parseIsoDate } from '$lib/domain/civil-date';

	/** Two weeks at a glance: sweep days stand out, today is outlined. */
	let { occurrences, done = null }: { occurrences: OccurrenceDto[]; done?: OccurrenceDto | null } = $props();
	const app = useAppState();
	const prefs = usePreferences();
	const DAYS = 14;

	const cells = $derived.by(() => {
		const today = app.clock.now.day;
		const narrow = new Intl.DateTimeFormat(prefs.locale, { weekday: 'narrow', timeZone: 'UTC' });
		const dayOfMonth = new Intl.DateTimeFormat(prefs.locale, { day: 'numeric', timeZone: 'UTC' });
		const byDay = new Map<number, OccurrenceDto>();
		const doneDay = done ? parseIsoDate(done.date) : -1;
		for (const o of occurrences) {
			const d = parseIsoDate(o.date);
			if (d < today + DAYS && !byDay.has(d)) byDay.set(d, o);
		}
		return Array.from({ length: DAYS }, (_, i) => {
			const day = today + i;
			const o = byDay.get(day);
			const date = prefs.f.longDate(day);
			return {
				day,
				initial: narrow.format(day * 86_400_000),
				number: dayOfMonth.format(day * 86_400_000),
				sweep: o ? prefs.f.timeWindow(o.from, o.to) : null,
				done: !o && day === doneDay,
				label: o
					? prefs.m.street.dayCell(date, prefs.f.timeWindow(o.from, o.to))
					: day === doneDay && done
						? prefs.m.status.doneToday(prefs.f.timeWindow(done.from, done.to))
						: prefs.m.street.dayCellNone(date),
				today: i === 0
			};
		});
	});
</script>

<section aria-labelledby="strip-title">
	<h3 id="strip-title" class="mb-2 text-sm font-semibold">{prefs.m.street.next14}</h3>
	<ol class="grid grid-cols-7 gap-1.5">
		{#each cells as cell (cell.day)}
			<li
				class="flex flex-col items-center rounded-xl py-1.5 text-center {cell.sweep ? 'bg-primary text-on-primary' : cell.done ? 'bg-surface-2 text-muted border-primary/60 border border-dashed' : 'bg-surface-2'} {cell.today ? 'ring-accent ring-2' : ''}"
				aria-label={cell.label}
				title={cell.sweep ?? undefined}
			>
				<span class="text-[0.65rem] font-semibold uppercase opacity-80" aria-hidden="true">{cell.initial}</span>
				<span class="text-sm font-bold tabular-nums" aria-hidden="true">{cell.number}</span>
				{#if cell.done}
					<span class="border-primary mt-0.5 size-1.5 rounded-full border" aria-hidden="true"></span>
				{:else}
					<span class="mt-0.5 size-1.5 rounded-full {cell.sweep ? 'bg-on-primary' : 'bg-transparent'}" aria-hidden="true"></span>
				{/if}
			</li>
		{/each}
	</ol>
</section>
