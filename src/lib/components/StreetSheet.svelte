<script lang="ts">
	import { tick } from "svelte";
	import { cubicOut } from "svelte/easing";
	import type { TransitionConfig } from "svelte/transition";
	import { useAppState, type StreetView } from "$lib/client/app-state.svelte";
	import { usePreferences } from "$lib/client/preferences.svelte";
	import { provideStreetModel } from "$lib/client/street-model.svelte";
	import Icon from "./Icon.svelte";
	import NearbyView from "./NearbyView.svelte";
	import ReminderView from "./ReminderView.svelte";
	import ScheduleView from "./ScheduleView.svelte";
	import Sheet from "./Sheet.svelte";
	import StreetOverview from "./StreetOverview.svelte";
	import TechnicalView from "./TechnicalView.svelte";
	import UpcomingView from "./UpcomingView.svelte";
	import VerifyView from "./VerifyView.svelte";

	/**
	 * The street bottom sheet. The header keeps the street name and the two
	 * actions (reminder, report) always in reach; the body navigates between
	 * an overview and detail screens, reminder and report included.
	 * Dismiss by swiping down, tapping outside or Esc.
	 */
	const app = useAppState();
	const prefs = usePreferences();
	const model = provideStreetModel(app, prefs);

	/** Navigation depth of a screen: the overview is the root, every other screen one level in. */
	const depth = (view: StreetView) => (view === "overview" ? 0 : 1);
	let lastView: StreetView = "overview";
	/** 1 going into a screen, -1 going back: read by the transitions of the change. */
	const direction = $derived.by(() => {
		const d = depth(app.view) >= depth(lastView) ? 1 : -1;
		lastView = app.view;
		return d;
	});

	/**
	 * Screen change as a push: the two screens slide side by side in the direction of
	 * navigation, the new one in from the right going forward, from the left going back.
	 * The outgoing screen leaves the flow, so the new one sets the height from the
	 * first frame and nothing below it jumps.
	 */
	function push(
		node: HTMLElement,
		{ entering }: { entering: boolean }
	): TransitionConfig {
		if (matchMedia("(prefers-reduced-motion: reduce)").matches)
			return { duration: 0 };
		if (!entering) node.classList.add("leaving");
		const offset = (entering ? 100 : -100) * direction;
		return {
			duration: 300,
			easing: cubicOut,
			css: (t) => `transform: translateX(${(1 - t) * offset}%)`,
		};
	}
	const m = $derived(prefs.m);

	const street = $derived(app.selected);
	/**
	 * Where it starts and ends: the chosen stretch, or else the whole street when it is one continuous
	 * piece with known end streets. The type is already in the name, the length lives in the technical details.
	 */
	const subtitle = $derived.by(() => {
		if (!street) return "";
		if (model.focus >= 0 && model.multiGroup)
			return model.groupLabel(model.focus);
		const [only] = street.sections;
		return street.sections.length === 1 && only && only.between.length
			? prefs.f.between(only.between, 0)
			: "";
	});
	const viewTitle = $derived.by(() => {
		switch (app.view) {
			case "overview":
				return "";
			case "reminder":
				return m.reminder.title;
			case "verify":
				return m.reviews.title;
			default:
				return m.street.views[app.view];
		}
	});

	let sheet = $state<{ expand(): void }>();
	// Reminder and report are forms: they open at full height, not at the resting detent.
	$effect(() => {
		if (app.view === "reminder" || app.view === "verify") sheet?.expand();
	});

	// Move focus to the current heading when the street or the screen changes.
	$effect(() => {
		void app.view;
		if (!street) return;
		void tick().then(() =>
			document
				.getElementById(
					app.view === "overview" ? "street-title" : "view-title"
				)
				?.focus({ preventScroll: true })
		);
	});
</script>

<Sheet
	bind:this={sheet}
	open={app.sheetOpen}
	onclose={() => app.clearSelection()}
	labelledby="street-title"
	snaps={["100%", "62%"]}
	initial={1}
>
	{#snippet header()}
		<div class="screens">
			{#key app.view}
				<div
					in:push={{ entering: true }}
					out:push={{ entering: false }}
				>
					{#if app.view !== "overview"}
						<div class="flex items-center gap-2 py-1">
							<button
								type="button"
								class="btn-ghost size-11 shrink-0 px-0"
								onclick={() => (app.view = "overview")}
								aria-label={m.common.back}
							>
								<Icon name="back" />
							</button>
							<div class="min-w-0">
								<h2
									id="view-title"
									class="truncate text-xl font-semibold outline-none"
									tabindex="-1"
								>
									{viewTitle}
								</h2>
								<p class="truncate text-sm text-muted">
									{street?.name}
								</p>
							</div>
						</div>
					{:else}
						<div class="flex items-start gap-3 py-1">
							<div class="min-w-0 flex-1">
								<h2
									id="street-title"
									class="text-[1.625rem] leading-tight font-semibold outline-none"
									tabindex="-1"
								>
									{street?.name ?? m.common.loading}
								</h2>
								{#if subtitle}<p
										class="mt-0.5 text-sm text-muted"
									>
										{subtitle}
									</p>{/if}
							</div>
							<button
								type="button"
								class="btn-ghost size-10 min-h-10 shrink-0 px-0"
								onclick={() => app.clearSelection()}
								aria-label={street
									? m.street.close(street.name)
									: m.common.close}
							>
								<Icon name="close" />
							</button>
						</div>
						{#if street}
							<div class="mt-2 grid grid-cols-2 gap-2">
								<button
									type="button"
									class="btn-secondary h-12 rounded-2xl"
									onclick={() => (app.view = "reminder")}
								>
									<Icon name="bell" size={18} />{m.actions
										.reminder}
								</button>
								<button
									type="button"
									class="btn-primary h-12 rounded-2xl"
									onclick={() => (app.view = "verify")}
								>
									<Icon name="check" size={18} />{m.actions
										.verify}
								</button>
							</div>
						{/if}
					{/if}
				</div>
			{/key}
		</div>
	{/snippet}

	{#if app.streetStatus === "loading" && !street}
		<div class="space-y-3 pt-2" role="status" aria-label={m.common.loading}>
			<div class="h-32 animate-pulse rounded-3xl bg-surface-2"></div>
			<div class="h-16 animate-pulse rounded-2xl bg-surface-2"></div>
			<div class="h-40 animate-pulse rounded-2xl bg-surface-2"></div>
		</div>
	{:else if app.streetStatus === "error" && app.streetError}
		<p class="py-4" role="alert">{m.errors[app.streetError]}</p>
	{:else if street}
		<!-- Screens slide side by side: forward from the right, back from the left (see push). -->
		<div class="screens">
			{#key app.view}
				<div
					in:push={{ entering: true }}
					out:push={{ entering: false }}
				>
					{#if app.view === "overview"}
						<StreetOverview />
					{:else if app.view === "schedule"}
						<ScheduleView />
					{:else if app.view === "upcoming"}
						<UpcomingView />
					{:else if app.view === "nearby"}
						<NearbyView />
					{:else if app.view === "reminder"}
						<ReminderView {street} />
					{:else if app.view === "verify"}
						<VerifyView {street} />
					{:else}
						<TechnicalView />
					{/if}
				</div>
			{/key}
		</div>
	{/if}
</Sheet>

<style>
	/* What slides past the side edges is clipped, never scrolled to. */
	.screens {
		position: relative;
		overflow-x: clip;
	}
	.screens > :global(.leaving) {
		position: absolute;
		inset: 0 0 auto;
	}
</style>
