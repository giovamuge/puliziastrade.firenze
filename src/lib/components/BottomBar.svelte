<script lang="ts">
	import { useAppState } from "$lib/client/app-state.svelte";
	import { wideScreen } from "$lib/client/media";
	import { usePreferences } from "$lib/client/preferences.svelte";
	import Icon from "./Icon.svelte";
	import FirstVisitNotice from "./FirstVisitNotice.svelte";
	import SearchBox from "./SearchBox.svelte";

	/** Primary controls, bottom centre within thumb reach: address search + "my location". */
	const app = useAppState();
	const prefs = usePreferences();
	const locating = $derived(app.locateStatus === "locating");

	/**
	 * How far the bar's resting bottom edge sits below the visible area (the keyboard top):
	 * the bar rises by exactly that much. Measured on the bar itself, not derived from
	 * `innerHeight`: Safari 26 changes that with its toolbar state (after the location
	 * prompt, for one), and the bar then floated well above the keyboard.
	 */
	function keyboardLift(node: HTMLElement): () => void {
		const vv = window.visualViewport;
		if (!vv) return () => {};
		let frame = 0;
		let lifted = 0;
		const apply = (hidden: number) => {
			lifted = hidden;
			node.style.setProperty("--keyboard", `${hidden}px`);
			// The home-indicator safe area is under the keyboard now: keep only a small gap.
			node.toggleAttribute("data-keyboard", hidden > 0);
		};
		const update = () => {
			frame = 0;
			// Only while one of the bar's fields has focus.
			if (!node.contains(document.activeElement)) return apply(0);
			// Client coordinates and the visual viewport both refer to the layout viewport.
			const bottom = node.getBoundingClientRect().bottom + lifted;
			apply(Math.max(0, Math.round(bottom - (vv.offsetTop + vv.height))));
		};
		const schedule = () => (frame ||= requestAnimationFrame(update));
		// Focus out drops the bar back at once, without waiting for the visual viewport to report
		// the keyboard closing (on iOS that can come late); moving to another field keeps it up.
		const onFocusOut = (event: FocusEvent) => {
			if (
				event.relatedTarget instanceof HTMLInputElement &&
				node.contains(event.relatedTarget)
			)
				return;
			cancelAnimationFrame(frame);
			frame = 0;
			apply(0);
		};
		vv.addEventListener("resize", schedule);
		vv.addEventListener("scroll", schedule);
		node.addEventListener("focusin", schedule);
		node.addEventListener("focusout", onFocusOut);
		update();
		return () => {
			cancelAnimationFrame(frame);
			vv.removeEventListener("resize", schedule);
			vv.removeEventListener("scroll", schedule);
			node.removeEventListener("focusin", schedule);
			node.removeEventListener("focusout", onFocusOut);
		};
	}
</script>

<!--
	Fixed to the bottom of the viewport, outside the full-bleed (and scaled) page, and lifted
	by the keyboard height while the keyboard is open (see keyboardLift).
	Its container has no background, so Safari does not tint its toolbar from it.
	Inert while a bottom sheet covers the page, like the page itself.
	On tablet/desktop the street sidebar takes the full height on the left, so the
	bar moves into the free area to its right.
-->
<div
	inert={app.sheetOpen && !wideScreen.current}
	{@attach keyboardLift}
	class={[
		"pointer-events-none fixed inset-x-0 bottom-0 z-40 flex translate-y-[calc(-1*var(--keyboard,0px))] flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] data-keyboard:pb-3",
		"transition-[left] duration-200 motion-reduce:transition-none",
		app.sheetOpen && "md:left-[calc(var(--sidebar-w)+0.75rem)]",
	]}
>
	<FirstVisitNotice />
	{#if app.locateError}
		<div
			class="pointer-events-auto flex w-full max-w-xl items-start gap-2 glass p-3 text-sm"
			role="alert"
		>
			<p class="flex-1">{prefs.m.locate[app.locateError]}</p>
			<button
				type="button"
				class="btn-ghost size-8 min-h-8 shrink-0 px-0"
				onclick={() => app.dismissLocateError()}
				aria-label={prefs.m.common.close}
			>
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
			{#if locating}<Icon
					name="locate"
					size={16}
					class="animate-spin"
				/>{/if}{prefs.m.locate.label}
		</button>
	</div>
	<p id="locate-privacy" class="sr-only">{prefs.m.locate.privacy}</p>
</div>
