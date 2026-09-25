<script lang="ts">
	import { useAppState } from '$lib/client/app-state.svelte';
	import { TONE_CLASSES, windowStatus } from '$lib/client/format';
	import { usePreferences } from '$lib/client/preferences.svelte';

	/** Streets around the user's position, nearest first, each with its own nearest segment's status. */
	const app = useAppState();
	const prefs = usePreferences();
</script>

<ul class="card divide-border divide-y pt-0">
	{#each app.nearby?.items ?? [] as item (item.slug)}
		{@const status = windowStatus(item.segmentNext, app.clock.now, prefs.f)}
		{@const current = app.selected?.slug === item.slug}
		<li>
			<button
				type="button"
				class="hover:bg-surface-2 flex w-full items-center gap-3 px-3 py-3 text-left {current ? 'bg-surface-2' : ''}"
				aria-current={current ? 'true' : undefined}
				onclick={() => app.selectStreet(item.slug, item.segment, prefs.m.street.selectedAnnounce)}
			>
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">{item.name}</span>
					<span class="text-muted block truncate text-sm">
						{prefs.f.distance(item.distanceMeters)}{item.segmentBetween.length ? ` · ${prefs.f.between(item.segmentBetween, 0)}` : ''}
					</span>
				</span>
				<span class="chip shrink-0 {TONE_CLASSES[status.tone]}">{status.badge}</span>
			</button>
		</li>
	{/each}
</ul>
