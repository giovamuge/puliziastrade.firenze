<script lang="ts">
	import type { Snippet } from "svelte";
	import Icon, { type IconName } from "./Icon.svelte";

	/** A tappable list row that navigates to a detail screen (iOS/Material style). */
	let {
		icon,
		title,
		subtitle,
		onclick,
		trailing,
	}: {
		icon: IconName;
		title: string;
		subtitle?: string;
		onclick: () => void;
		trailing?: Snippet;
	} = $props();
</script>

<li>
	<button
		type="button"
		class="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-2"
		{onclick}
	>
		<span
			class="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-primary-text"
			><Icon name={icon} size={18} /></span
		>
		<span class="min-w-0 flex-1">
			<span class="block font-semibold">{title}</span>
			{#if subtitle}<span class="block truncate text-sm text-muted"
					>{subtitle}</span
				>{/if}
		</span>
		{@render trailing?.()}
		<Icon name="chevron" class="shrink-0 text-muted" />
	</button>
</li>
