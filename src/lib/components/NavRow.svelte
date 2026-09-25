<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	/** A tappable list row that navigates to a detail screen (iOS/Material style). */
	let { icon, title, subtitle, onclick, trailing }: { icon: IconName; title: string; subtitle?: string; onclick: () => void; trailing?: Snippet } = $props();
</script>

<li>
	<button type="button" class="hover:bg-surface-2 flex w-full items-center gap-3 px-3 py-3 text-left" {onclick}>
		<span class="bg-surface-2 text-primary-text grid size-10 shrink-0 place-items-center rounded-xl"><Icon name={icon} size={18} /></span>
		<span class="min-w-0 flex-1">
			<span class="block font-semibold">{title}</span>
			{#if subtitle}<span class="text-muted block truncate text-sm">{subtitle}</span>{/if}
		</span>
		{@render trailing?.()}
		<Icon name="chevron" class="text-muted shrink-0" />
	</button>
</li>
