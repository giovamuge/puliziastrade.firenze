<script lang="ts">
	import { useAppState } from '$lib/client/app-state.svelte';
	import { relativeDay } from '$lib/client/format';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import { useStreetModel } from '$lib/client/street-model.svelte';
	import { parseIsoDate } from '$lib/domain/civil-date';

	/** Every sweep in the next two months for the focused stretch (or the whole street). */
	const app = useAppState();
	const prefs = usePreferences();
	const model = useStreetModel();
</script>

<div class="pt-1">
	{#if model.focusUpcoming.length}
		<ol class="card divide-border divide-y">
			{#each model.focusUpcoming as o (o.date + o.from)}
				{@const day = parseIsoDate(o.date)}
				<li class="flex items-center justify-between gap-3 px-3 py-2.5">
					<span class="min-w-0">
						<span class="block font-medium">{prefs.f.longDate(day, true)}</span>
						<span class="text-muted block text-sm">{prefs.f.timeWindow(o.from, o.to)} · {model.scopeOf(o)}</span>
					</span>
					<span class="text-muted text-sm whitespace-nowrap">{relativeDay(day, app.clock.now.day, prefs.f)}</span>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="text-muted text-sm">{prefs.m.street.noUpcoming}</p>
	{/if}
</div>
