<script lang="ts">
	import { useAppState } from '$lib/client/app-state.svelte';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import Icon from './Icon.svelte';
	import FirstVisitNotice from './FirstVisitNotice.svelte';
	import SearchBox from './SearchBox.svelte';

	/** Primary controls, bottom centre within thumb reach: address search + "my location". */
	const app = useAppState();
	const prefs = usePreferences();
	const locating = $derived(app.locateStatus === 'locating');
</script>

<!--
	Centred on the map, at the bottom of the visible area (the page's viewport layer).
	On tablet/desktop the street sidebar takes the full height on the left, so the
	bar moves into the free area to its right.
-->
<div
	class={[
		'pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]',
		'transition-[left] duration-200 motion-reduce:transition-none',
		app.sheetOpen && 'md:left-[calc(var(--sidebar-w)+0.75rem)]'
	]}
>
	<FirstVisitNotice />
	{#if app.locateError}
		<div class="glass pointer-events-auto flex w-full max-w-xl items-start gap-2 p-3 text-sm" role="alert">
			<p class="flex-1">{prefs.m.locate[app.locateError]}</p>
			<button type="button" class="btn-ghost size-8 min-h-8 shrink-0 px-0" onclick={() => app.dismissLocateError()} aria-label={prefs.m.common.close}>
				<Icon name="close" size={16} />
			</button>
		</div>
	{/if}
	<div class="pointer-events-auto flex w-full max-w-xl items-center gap-2">
		<div class="min-w-0 flex-1"><SearchBox /></div>
		<!-- The visible text is the accessible name; the title adds the full question for pointer users. -->
		<button
			type="button"
			class="btn-primary h-14 shrink-0 rounded-full px-4 whitespace-nowrap shadow-xl shadow-black/20"
			onclick={() => app.locate(() => prefs.m)}
			disabled={locating}
			aria-busy={locating}
			title={prefs.m.locate.button}
			aria-describedby="locate-privacy"
		>
			{#if locating}<Icon name="locate" size={16} class="animate-spin" />{/if}{prefs.m.locate.label}
		</button>
	</div>
	<p id="locate-privacy" class="sr-only">{prefs.m.locate.privacy}</p>
</div>
