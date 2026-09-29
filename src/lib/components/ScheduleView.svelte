<script lang="ts">
	import { useAppState } from "$lib/client/app-state.svelte";
	import { TONE_CLASSES, windowStatus } from "$lib/client/format";
	import { usePreferences } from "$lib/client/preferences.svelte";
	import { useStreetModel } from "$lib/client/street-model.svelte";
	import { groupColor } from "$lib/client/map-style";
	import Icon from "./Icon.svelte";

	/** All schedules of the street; with several stretches, each is a selectable card. */
	const app = useAppState();
	const prefs = usePreferences();
	const model = useStreetModel();
	const street = $derived(model.street!);
</script>

<div class="space-y-3 pt-1">
	{#if street.sections.length > 1}<p class="text-sm text-muted">
			{prefs.m.street.sectionsNote(street.sections.length)}
		</p>{/if}
	{#if model.multiGroup}
		<p class="text-sm text-muted">{prefs.m.street.schedulesHint}</p>
		<ul class="space-y-2">
			{#each street.groups as group, i (i)}
				{@const next = windowStatus(
					model.groupNext(i),
					app.clock.now,
					prefs.f
				)}
				{@const active = model.focus === i}
				<li>
					<button
						type="button"
						class="w-full card p-3 text-left transition-colors {active
							? 'border-accent ring-2 ring-accent'
							: 'hover:bg-surface-2'}"
						aria-pressed={active}
						onclick={() => app.selectGroup(i)}
					>
						<span class="flex items-start justify-between gap-2">
							<span class="min-w-0">
								<span
									class="flex items-center gap-2 font-semibold"
								>
									<span
										class="size-3 shrink-0 rounded-full"
										style:background-color={groupColor(
											prefs.theme,
											i
										)}
										aria-hidden="true"
									></span>
									{model.groupLabel(i)}
								</span>
								<span class="block text-xs text-muted">
									{prefs.m.street.segments(
										group.segments.length
									)} · {prefs.f.distance(
										group.lengthMeters
									)}{active
										? ` · ${prefs.m.street.yourSegment}`
										: ""}
								</span>
							</span>
							<span
								class="chip shrink-0 {TONE_CLASSES[next.tone]}"
								>{next.badge}</span
							>
						</span>
						<span class="mt-2 block space-y-0.5 text-sm">
							{#each group.rules as rule (rule.weekday + "-" + rule.from)}
								<span class="flex items-start gap-2"
									><Icon
										name="calendar"
										size={16}
										class="mt-0.5 shrink-0 text-primary-text"
									/>{prefs.f.rule(rule)}</span
								>
							{/each}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<ul class="divide-y divide-border card">
			{#each street.rules as rule (rule.weekday + "-" + rule.from)}
				<li class="flex items-start gap-3 p-3">
					<Icon
						name="calendar"
						size={18}
						class="mt-0.5 shrink-0 text-primary-text"
					/>{prefs.f.rule(rule)}
				</li>
			{/each}
		</ul>
	{/if}
</div>
