<script lang="ts">
	import { useAppState } from '$lib/client/app-state.svelte';
	import { legendFor, legendLabels } from '$lib/client/map-style';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import { NO_BAND } from '$lib/domain/urgency';
	import Icon from './Icon.svelte';

	/** Legend in a popover: kept apart from the filters, opened on demand. */
	const app = useAppState();
	const prefs = usePreferences();
	const uid = $props.id();

	const entries = $derived(legendFor(app.mapMode, prefs.theme));
	const labels = $derived(legendLabels(app.mapMode, prefs.m));
</script>

<button type="button" class="glass text-text grid size-11 place-items-center" popovertarget="{uid}-legend" aria-label={prefs.m.map.legendOpen} title={prefs.m.map.legend}>
	<Icon name="legend" />
</button>

<div id="{uid}-legend" popover class="glass fixed top-16 right-3 left-auto w-80 max-w-[calc(100vw-1.5rem)] p-4 max-sm:top-auto max-sm:right-2 max-sm:bottom-2 max-sm:left-2 max-sm:w-auto" aria-labelledby="{uid}-title">
	<div class="mb-2 flex items-center justify-between gap-2">
		<h2 id="{uid}-title" class="font-sans text-sm font-bold">{prefs.m.map.legend} · {prefs.m.map.modes[app.mapMode]}</h2>
		<button type="button" class="btn-ghost size-9 min-h-9 px-0" popovertarget="{uid}-legend" popovertargetaction="hide" aria-label={prefs.m.common.close}>
			<Icon name="close" size={18} />
		</button>
	</div>
	<ul class="space-y-2 text-sm">
		{#each entries as entry, i (entry.value)}
			<li class="flex items-center gap-3">
				<svg width="34" height="12" aria-hidden="true"><line x1="3" y1="6" x2="31" y2="6" stroke={entry.color} stroke-width={Math.max(1.5, entry.width)} stroke-linecap="round" /></svg>
				<span>{labels[i]}</span>
				{#if app.mapCounts.length && app.mapMode !== 'reviews'}
					<span class="text-muted ml-auto tabular-nums">{prefs.f.number(app.mapCounts[entry.value === NO_BAND ? 7 : entry.value] ?? 0)}</span>
				{/if}
			</li>
		{/each}
	</ul>
	<p class="text-muted mt-3 text-xs">{prefs.m.map.legendHint}</p>
</div>
