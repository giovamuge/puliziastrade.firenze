<script lang="ts" module>
	let registration: Promise<void> | undefined;

	/** Registers the custom elements once, client side only. */
	function register(): Promise<void> {
		registration ??= import('pure-web-bottom-sheet').then(({ registerSheetElements }) => {
			if (!customElements.get('bottom-sheet')) registerSheetElements();
		});
		return registration;
	}
</script>

<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import { wideScreen } from '$lib/client/media';
	import { scrollFade } from '$lib/client/scroll-fade';

	/**
	 * Adaptive panel for the street details.
	 *
	 * - Phones: modal bottom sheet (pure-web-bottom-sheet on a native <dialog>):
	 *   CSS scroll-snap drag physics, dismiss by swiping down, tapping outside or Esc.
	 * - Tablets and desktop: non-modal sidebar on the left, the map stays usable.
	 *   "sub" panels (reminder, report) slide over the main one, like a navigation push.
	 *
	 * `open` is controlled by the parent; `onclose` fires whenever the user dismisses it.
	 */
	let {
		open,
		onclose,
		labelledby,
		snaps = ['100%'],
		initial = 0,
		variant = 'main',
		header,
		children
	}: {
		open: boolean;
		onclose: () => void;
		labelledby: string;
		/** Bottom sheet snap points, top to bottom (CSS lengths; % of the sheet max height). */
		snaps?: string[];
		/** Index in `snaps` of the initial position. */
		initial?: number;
		variant?: 'main' | 'sub';
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
		if (open && !wide && !dialog.open) dialog.showModal();
		else if ((!open || wide) && dialog.open) dialog.close();
	});

	function onDialogClose(): void {
		// Closing because the layout switched to the sidebar is not a user dismissal.
		if (open && !wide) onclose();
	}

	/**
	 * Wires scroll fade and a swipe-to-dismiss safety net on the sheet: the
	 * library detects the collapsed state with an IntersectionObserver that may
	 * not fire in some environments, leaving an invisible modal that blocks the
	 * page. The sheet is the snap scroller: once raised, settling back at the
	 * bottom (scrollTop ≈ 0) means the user swiped it away.
	 */
	function sheetBehaviour(sheet: HTMLElement): () => void {
		let raised = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let disposeFade: (() => void) | undefined;
		void register().then(() => {
			// The scrolling element lives in the component's (open) shadow root.
			const content = sheet.shadowRoot?.querySelector<HTMLElement>('.sheet-content');
			if (content) disposeFade = scrollFade(content, sheet);
		});
		const settle = () => {
			if (raised && dialog?.open && sheet.scrollTop <= 1) dialog.close();
		};
		const onScroll = () => {
			if (sheet.scrollTop > 40) raised = true;
			clearTimeout(timer);
			timer = setTimeout(settle, 180);
		};
		const onOpen = () => (raised = false);
		sheet.addEventListener('scroll', onScroll, { passive: true });
		dialog?.addEventListener('toggle', onOpen);
		return () => {
			disposeFade?.();
			clearTimeout(timer);
			sheet.removeEventListener('scroll', onScroll);
			dialog?.removeEventListener('toggle', onOpen);
		};
	}

	// ---- Sidebar (tablets, desktop) ---------------------------------------------

	let returnFocus: HTMLElement | null = null;
	$effect(() => {
		if (!wide) return;
		if (open) {
			returnFocus ??= document.activeElement instanceof HTMLElement ? document.activeElement : null;
			void tick().then(() => document.getElementById(labelledby)?.focus({ preventScroll: true }));
		} else if (returnFocus) {
			// Sub panels hand focus back to where the user was (e.g. the action button).
			if (variant === 'sub' && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
			returnFocus = null;
		}
	});

	let panel: HTMLElement | undefined = $state();

	/** Esc closes the panel that holds focus (the topmost one, since sub panels take focus). */
	function onWindowKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && wide && open && panel?.contains(event.target as Node)) {
			event.stopPropagation();
			onclose();
		}
	}

	const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if wide}
	{#if open}
		<aside
			bind:this={panel}
			class="glass fixed top-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 flex w-(--sidebar-w) flex-col overflow-hidden {variant === 'sub' ? 'z-40 shadow-2xl' : 'z-30'}"
			aria-labelledby={labelledby}
			transition:fly={{ x: variant === 'sub' ? 32 : -32, duration: reducedMotion() ? 0 : 200 }}
		>
			<div class="border-border shrink-0 border-b px-4 pt-3 pb-2">{@render header()}</div>
			<div class="scroll-fade flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4" {@attach (node) => scrollFade(node)}>
				{@render children()}
			</div>
		</aside>
	{/if}
{:else}
	<bottom-sheet-dialog-manager>
		<dialog bind:this={dialog} aria-labelledby={labelledby} onclose={onDialogClose}>
			<bottom-sheet {@attach sheetBehaviour} class={variant === 'sub' ? 'sheet-sub' : ''} swipe-to-dismiss nested-scroll tabindex="-1">
				{#each snaps as snap, i (snap)}
					<div slot="snap" style="--snap: {snap}" class={[i === initial && 'initial', i === 0 && snap === '100%' && 'top']}></div>
				{/each}
				<div slot="header" class="px-4 pb-2">{@render header()}</div>
				{#if open}{@render children()}{/if}
			</bottom-sheet>
		</dialog>
	</bottom-sheet-dialog-manager>
{/if}
