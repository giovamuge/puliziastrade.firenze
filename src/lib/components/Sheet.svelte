<script lang="ts" module>
	let registration: Promise<void> | undefined;

	/** Registers the custom elements once, client side only. */
	function register(): Promise<void> {
		registration ??= import("pure-web-bottom-sheet").then(
			({ registerSheetElements }) => {
				if (!customElements.get("bottom-sheet"))
					registerSheetElements();
			}
		);
		return registration;
	}
</script>

<script lang="ts">
	import { onMount, tick, type Snippet } from "svelte";
	import { fly } from "svelte/transition";
	import { wideScreen } from "$lib/client/media";
	import { scrollFade } from "$lib/client/scroll-fade";
	import { sheetSource } from "$lib/client/sheet-backdrop";

	/**
	 * Adaptive panel for the street details.
	 *
	 * - Phones: bottom sheet (pure-web-bottom-sheet on a native <dialog>):
	 *   CSS scroll-snap drag physics, dismiss by swiping down, tapping outside or Esc.
	 *   The first upward scroll expands the sheet to full height; only then does its
	 *   content scroll (`expand-to-scroll`).
	 *   The dialog is opened non-modally with modal behaviour rebuilt here and in
	 *   sheet-backdrop.ts (page inert and dimmed, full-screen tap catcher, Esc):
	 *   with a modal dialog Safari 26 stops drawing the page under its status bar.
	 * - Tablets and desktop: non-modal sidebar on the left, the map stays usable.
	 *
	 * `open` is controlled by the parent; `onclose` fires whenever the user dismisses it.
	 */
	let {
		open,
		onclose,
		labelledby,
		snaps = ["100%"],
		initial = 0,
		header,
		children,
	}: {
		open: boolean;
		onclose: () => void;
		labelledby: string;
		/** Bottom sheet snap points, top to bottom (CSS lengths; % of the sheet max height). */
		snaps?: string[];
		/** Index in `snaps` of the initial position. */
		initial?: number;
		header: Snippet;
		children: Snippet;
	} = $props();

	// Decide the layout only after hydration, so server and client markup match.
	let mounted = $state(false);
	const wide = $derived(mounted && wideScreen.current);

	let dialog: HTMLDialogElement | undefined = $state();
	let ready = $state(false);

	onMount(() => {
		mounted = true;
		void register().then(() => (ready = true));
	});

	// ---- Bottom sheet (phones) --------------------------------------------------

	$effect(() => {
		if (!ready || !dialog) return;
		if (open && !wide && !dialog.open) dialog.show();
		else if ((!open || wide) && dialog.open) dialog.close();
	});

	function onDialogClose(): void {
		// Closing because the layout switched to the sidebar is not a user dismissal.
		if (open && !wide) onclose();
	}

	/** The dialog covers the screen: a tap on it, outside the sheet, dismisses. */
	function onDialogClick(event: MouseEvent): void {
		if (event.target === dialog) dialog.close();
	}

	function onDialogKeydown(event: KeyboardEvent): void {
		if (event.key !== "Escape" || !dialog?.open) return;
		event.stopPropagation();
		dialog.close();
	}

	/** Scroll fraction (0–1 of the sheet max height) of the resting detent. */
	const restFraction = $derived(
		Math.min(1, (Number.parseFloat(snaps[initial] ?? "100") || 100) / 100)
	);

	/**
	 * Wires scroll fade, the page-sheet backdrop and a swipe-to-dismiss safety net on the sheet.
	 * Backdrop: raising the sheet from its resting detent to the top makes the page recede (0 → 1).
	 * Safety net: the library detects the collapsed state with an IntersectionObserver
	 * that may not fire in some environments, leaving an invisible modal that blocks
	 * the page. The sheet is the snap scroller: once raised, settling back at the
	 * bottom (scrollTop ≈ 0) means the user swiped it away.
	 */
	function sheetBehaviour(sheet: HTMLElement): () => void {
		let raised = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let disposeFade: (() => void) | undefined;
		let frame = 0;
		const backdrop = sheetSource();
		const measure = () => {
			frame = 0;
			const range = sheet.scrollHeight - sheet.clientHeight;
			if (!dialog?.open || range <= 0) return backdrop.lift(0);
			const raised = sheet.scrollTop / range;
			const rest = restFraction;
			backdrop.lift(
				Math.min(
					1,
					Math.max(
						0,
						rest >= 1 ? raised : (raised - rest) / (1 - rest)
					)
				)
			);
		};
		void register().then(() => {
			// The scrolling element lives in the component's (open) shadow root.
			const content =
				sheet.shadowRoot?.querySelector<HTMLElement>(".sheet-content");
			if (content) disposeFade = scrollFade(content, sheet);
		});
		const settle = () => {
			if (raised && dialog?.open && sheet.scrollTop <= 1) dialog.close();
		};
		const onScroll = () => {
			frame ||= requestAnimationFrame(measure);
			if (sheet.scrollTop > 40) raised = true;
			clearTimeout(timer);
			timer = setTimeout(settle, 180);
		};
		const onToggle = () => {
			raised = false;
			backdrop.open(dialog?.open ?? false);
		};
		sheet.addEventListener("scroll", onScroll, { passive: true });
		dialog?.addEventListener("toggle", onToggle);
		return () => {
			cancelAnimationFrame(frame);
			backdrop.dispose();
			disposeFade?.();
			clearTimeout(timer);
			sheet.removeEventListener("scroll", onScroll);
			dialog?.removeEventListener("toggle", onToggle);
		};
	}

	/**
	 * Raises the bottom sheet to full height (no-op in the sidebar). The `<bottom-sheet>`
	 * is the snap scroller, so scrolling it to the end lands on the top detent; its own
	 * `snapToPoint` uses scrollIntoView, which would also scroll the page.
	 */
	export function expand(): void {
		const sheet = dialog?.querySelector("bottom-sheet");
		if (!sheet || wide) return;
		sheet.scrollTo({
			top: sheet.scrollHeight,
			behavior: reducedMotion() ? "instant" : "smooth",
		});
	}

	// ---- Sidebar (tablets, desktop) ---------------------------------------------

	$effect(() => {
		if (!wide || !open) return;
		void tick().then(() =>
			document.getElementById(labelledby)?.focus({ preventScroll: true })
		);
	});

	let panel: HTMLElement | undefined = $state();

	/** Esc closes the panel while it holds focus. */
	function onWindowKeydown(event: KeyboardEvent): void {
		if (
			event.key === "Escape" &&
			wide &&
			open &&
			panel?.contains(event.target as Node)
		) {
			event.stopPropagation();
			onclose();
		}
	}

	const reducedMotion = () =>
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-reduced-motion: reduce)").matches;
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if wide}
	{#if open}
		<aside
			data-sheet-panel
			bind:this={panel}
			class="fixed top-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-30 flex w-(--sidebar-w) flex-col overflow-hidden glass"
			aria-labelledby={labelledby}
			transition:fly={{
				x: -32,
				duration: reducedMotion() ? 0 : 200,
			}}
		>
			<div class="shrink-0 border-b border-border px-4 pt-3 pb-2">
				{@render header()}
			</div>
			<div
				class="scroll-fade flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4"
				{@attach (node) => scrollFade(node)}
			>
				{@render children()}
			</div>
		</aside>
	{/if}
{:else}
	<bottom-sheet-dialog-manager>
		<!--
			No tabindex on <bottom-sheet>: on iOS a tap focuses the nearest focusable
			ancestor, and focusing the scroll container retargets the synthetic click
			to it (or to the <dialog>, where a tap counts as outside the sheet):
			buttons never fired and the sheet closed. Opening focuses the heading instead.
		-->
		<dialog
			bind:this={dialog}
			aria-labelledby={labelledby}
			aria-modal="true"
			onclose={onDialogClose}
			onclick={onDialogClick}
			onkeydown={onDialogKeydown}
		>
			<bottom-sheet
				data-sheet-panel
				{@attach sheetBehaviour}
				swipe-to-dismiss
				nested-scroll
				expand-to-scroll
			>
				{#each snaps as snap, i (snap)}
					<div
						slot="snap"
						style="--snap: {snap}"
						class={[
							i === initial && "initial",
							i === 0 && snap === "100%" && "top",
						]}
					></div>
				{/each}
				<div slot="header" class="px-4 pb-2">{@render header()}</div>
				<!-- Horizontal padding lives here, not on ::part(content): on iOS the library sizes a
				     pseudo-element from the content padding, which would make it scroll sideways. -->
				<div class="px-4">
					{#if open}{@render children()}{/if}
				</div>
			</bottom-sheet>
		</dialog>
	</bottom-sheet-dialog-manager>
{/if}
