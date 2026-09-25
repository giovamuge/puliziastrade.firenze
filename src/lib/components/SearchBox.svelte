<script lang="ts">
	import type { StreetSummaryDto } from '$lib/api/contracts';
	import type { ApiErrorCode } from '$lib/api/contracts';
	import { api, errorCode } from '$lib/client/api';
	import { useAppState } from '$lib/client/app-state.svelte';
	import { TONE_CLASSES, windowStatus } from '$lib/client/format';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import { scrollFade } from '$lib/client/scroll-fade';
	import Icon from './Icon.svelte';

	/**
	 * Accessible autocomplete following the WAI-ARIA APG "combobox with
	 * listbox popup" pattern. Search runs server-side (full-text, fuzzy,
	 * abbreviation-aware) with debounce and request cancellation.
	 */
	const app = useAppState();
	const prefs = usePreferences();
	const uid = $props.id();
	const listId = `${uid}-list`;
	const DEBOUNCE_MS = 140;

	let query = $state('');
	let results = $state<StreetSummaryDto[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let loading = $state(false);
	let error = $state<ApiErrorCode | null>(null);
	let input: HTMLInputElement;

	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | null = null;

	function onInput(): void {
		clearTimeout(timer);
		controller?.abort();
		error = null;
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			open = false;
			loading = false;
			return;
		}
		loading = true;
		timer = setTimeout(() => void runSearch(q), DEBOUNCE_MS);
	}

	async function runSearch(q: string): Promise<void> {
		controller = new AbortController();
		try {
			const response = await api.search(q, controller.signal);
			results = response.results;
			active = results.length > 0 ? 0 : -1;
			open = true;
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			error = errorCode(e);
			results = [];
			open = true;
		} finally {
			loading = false;
		}
	}

	function choose(item: StreetSummaryDto): void {
		query = item.name;
		open = false;
		active = -1;
		void app.selectStreet(item.slug, null, prefs.m.street.selectedAnnounce);
	}

	function onKeydown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowDown':
				if (!open && results.length) open = true;
				else active = (active + 1) % Math.max(1, results.length);
				event.preventDefault();
				break;
			case 'ArrowUp':
				active = active <= 0 ? results.length - 1 : active - 1;
				event.preventDefault();
				break;
			case 'Enter': {
				const item = open ? results[active] : undefined;
				if (item) {
					choose(item);
					event.preventDefault();
				}
				break;
			}
			case 'Escape':
				if (open) open = false;
				else query = '';
				event.preventDefault();
				break;
		}
	}

	function clear(): void {
		query = '';
		results = [];
		open = false;
		input.focus();
	}

	const statusText = $derived(
		loading ? prefs.m.search.searching : open ? (error ? prefs.m.errors[error] : results.length ? prefs.m.search.results(results.length) : prefs.m.search.none) : ''
	);
</script>

<div class="relative">
	<label for="{uid}-input" class="sr-only">{prefs.m.search.label}</label>
	<div class="relative">
		<Icon name="search" class="text-muted pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2" />
		<input
			bind:this={input}
			bind:value={query}
			id="{uid}-input"
			type="text"
			role="combobox"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			enterkeyhint="search"
			placeholder={prefs.m.search.placeholder}
			aria-autocomplete="list"
			aria-expanded={open}
			aria-controls={listId}
			aria-activedescendant={open && active >= 0 ? `${uid}-opt-${active}` : undefined}
			aria-describedby="{uid}-hint"
			class="glass placeholder:text-muted focus:border-accent h-14 w-full rounded-full pr-11 pl-12 text-base outline-none"
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={() => results.length && (open = true)}
			onblur={() => setTimeout(() => (open = false), 120)}
		/>
		{#if query}
			<button type="button" class="text-muted hover:text-text absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg" onclick={clear} aria-label={prefs.m.search.clear}>
				<Icon name="close" size={18} />
			</button>
		{/if}
	</div>
	<p id="{uid}-hint" class="sr-only">{prefs.m.search.hint}</p>

	<ul
		{@attach (node) => scrollFade(node)}
		id={listId}
		role="listbox"
		aria-label={prefs.m.search.listLabel}
		class="glass scroll-fade absolute bottom-full z-30 mb-2 max-h-[55dvh] w-full overflow-auto p-1"
		hidden={!open || (!results.length && !error)}
	>
		{#if error}
			<li class="text-muted px-3 py-2 text-sm" role="presentation">{prefs.m.errors[error]}</li>
		{/if}
		{#each results as item, i (item.slug)}
			{@const status = windowStatus(item.next, app.clock.now, prefs.f)}
			<!-- Keyboard interaction lives on the combobox input (aria-activedescendant), per the APG pattern. -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<li
				id="{uid}-opt-{i}"
				role="option"
				aria-selected={i === active}
				class="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 {i === active ? 'bg-surface-2' : ''}"
				onpointerdown={(e) => e.preventDefault()}
				onclick={() => choose(item)}
				onpointerenter={() => (active = i)}
			>
				<span class="min-w-0">
					<span class="block truncate font-medium">{item.name}</span>
					<span class="text-muted block text-xs">{prefs.m.search.segments(item.segmentCount)}{item.sectionCount > 1 ? ` · ${prefs.m.search.parts(item.sectionCount)}` : ''}</span>
				</span>
				<span class="chip {TONE_CLASSES[status.tone]}">{status.badge}</span>
			</li>
		{/each}
	</ul>
	<div class="sr-only" role="status" aria-live="polite">{statusText}</div>
</div>
