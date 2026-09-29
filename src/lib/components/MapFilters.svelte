<script lang="ts">
	import { useAppState, type MapMode } from "$lib/client/app-state.svelte";
	import { usePreferences } from "$lib/client/preferences.svelte";

	/** Map filters: view mode and, for the "by day" view, which day. */
	const app = useAppState();
	const prefs = usePreferences();
	const uid = $props.id();
	const MODES: MapMode[] = ["urgency", "day", "reviews"];
	const days = $derived(
		Array.from({ length: 7 }, (_, i) => app.clock.now.day + i)
	);
</script>

<div class="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
	<!-- min-w-0: a fieldset is min-content wide by default, it would overflow instead of scrolling. -->
	<fieldset class="min-w-0 glass p-1">
		<legend class="sr-only">{prefs.m.map.filters}</legend>
		<div class="flex gap-1">
			{#each MODES as mode (mode)}
				<!-- Width follows the text (flex-auto), so a long label takes the room short ones leave. -->
				<label
					class="grid min-h-9 flex-auto cursor-pointer place-items-center rounded-xl px-2.5 text-center text-xs font-semibold whitespace-nowrap text-text hover:bg-surface-2 has-checked:bg-primary has-checked:text-on-primary has-focus-visible:outline-2 has-focus-visible:outline-accent sm:flex-none sm:px-3"
				>
					<input
						type="radio"
						class="sr-only"
						name="{uid}-mode"
						value={mode}
						bind:group={app.mapMode}
						aria-label={prefs.m.map.modes[mode]}
					/>
					<span aria-hidden="true"
						>{prefs.m.map.modesShort[mode]}</span
					>
				</label>
			{/each}
		</div>
	</fieldset>

	{#if app.mapMode === "day"}
		<fieldset class="max-w-full min-w-0 glass p-1">
			<legend class="sr-only">{prefs.m.map.dayFilter}</legend>
			<div
				class="flex [scrollbar-width:none] gap-1 overflow-x-auto overscroll-x-contain rounded-xl"
			>
				{#each days as d, i (d)}
					<label
						class="min-h-9 shrink-0 cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold text-text hover:bg-surface-2 has-checked:bg-text has-checked:text-bg has-focus-visible:outline-2 has-focus-visible:outline-accent"
					>
						<input
							type="radio"
							class="sr-only"
							name="{uid}-day"
							value={i}
							bind:group={app.dayOffset}
						/>
						{i === 0
							? prefs.m.map.today
							: i === 1
								? prefs.m.map.tomorrow
								: prefs.f.shortDate(d)}
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}
</div>
