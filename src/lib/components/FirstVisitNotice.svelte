<script lang="ts">
	import { onMount } from "svelte";
	import { usePreferences } from "$lib/client/preferences.svelte";
	import Icon from "./Icon.svelte";

	/**
	 * One-time disclaimer: unofficial service, where the data comes from, road
	 * signs prevail, and only technical storage (so no consent banner needed).
	 * Dismissal is remembered in localStorage.
	 */
	const prefs = usePreferences();
	const KEY = "notice";
	let visible = $state(false);

	onMount(() => {
		try {
			visible = localStorage.getItem(KEY) !== "1";
		} catch {
			visible = true;
		}
	});

	function dismiss(): void {
		visible = false;
		try {
			localStorage.setItem(KEY, "1");
		} catch {
			/* private mode: shown again next time */
		}
	}
</script>

{#if visible}
	<aside
		class="pointer-events-auto flex w-full max-w-xl items-start gap-3 glass p-3 text-sm"
		aria-label={prefs.m.common.unofficial}
	>
		<Icon name="info" size={18} class="mt-0.5 shrink-0 text-primary-text" />
		<div class="min-w-0 flex-1 space-y-2">
			<p>{prefs.m.notice.text}</p>
			<p class="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
				<a href="/info#avvertenze" class="underline"
					>{prefs.m.notice.details}</a
				>
				<a href="/privacy" class="underline">{prefs.m.common.privacy}</a
				>
			</p>
		</div>
		<button
			type="button"
			class="btn-secondary min-h-9 shrink-0 px-3 text-xs"
			onclick={dismiss}>{prefs.m.notice.ok}</button
		>
	</aside>
{/if}
