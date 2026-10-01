<script lang="ts">
	import type {
		ApiErrorCode,
		ReviewOutcome,
		StreetDetailDto,
		StreetReviewsResponse,
	} from "$lib/api/contracts";
	import { REVIEW_OUTCOMES } from "$lib/api/contracts";
	import { api, errorCode } from "$lib/client/api";
	import { useAppState } from "$lib/client/app-state.svelte";
	import { usePreferences } from "$lib/client/preferences.svelte";
	import { parseIsoDate } from "$lib/domain/civil-date";
	import { useStreetModel } from "$lib/client/street-model.svelte";
	import { OFFICIAL_CHANNELS } from "$lib/site";
	import Icon from "./Icon.svelte";

	/** Report screen of the street sheet: did the sweep happen, and how well? */
	let { street }: { street: StreetDetailDto } = $props();
	const app = useAppState();
	const prefs = usePreferences();
	const m = $derived(prefs.m.reviews);
	const f = $derived(prefs.f);

	let data = $state<StreetReviewsResponse | null>(null);
	let loadError = $state<ApiErrorCode | null>(null);

	let date = $state("");
	let outcome = $state<ReviewOutcome | "">("");
	let rating = $state(0);
	let note = $state("");
	let website = $state("");
	/** Optional: the time window read on the street sign, when it differs from the data. */
	let signDiffers = $state(false);
	let signFrom = $state("");
	let signTo = $state("");
	const toMinutes = (hhmm: string): number | null => {
		const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
		return match ? Number(match[1]) * 60 + Number(match[2]) : null;
	};
	let sending = $state(false);
	let formError = $state<ApiErrorCode | "choose" | null>(null);
	let sent = $state(false);

	$effect(() => {
		const controller = new AbortController();
		data = null;
		sent = false;
		loadError = null;
		api.reviews(street.slug, controller.signal)
			.then((r) => {
				data = r;
				date = r.verifiableDates[0] ?? "";
			})
			.catch(
				(e: Error) =>
					e.name !== "AbortError" && (loadError = errorCode(e))
			);
		return () => controller.abort();
	});

	const model = useStreetModel();
	/** Dates to verify, limited to the stretch in focus (sweeps in progress or done in the last days). */
	const dates = $derived.by(() => {
		const all = data?.verifiableDates ?? [];
		if (model.focus < 0) return all;
		const relevant = new Set(
			[...(street.recent ?? []), ...model.upcoming]
				.filter((o) => o.groups.includes(model.focus))
				.map((o) => o.date)
		);
		return all.filter((d) => relevant.has(d));
	});
	$effect(() => {
		if (!dates.includes(date)) date = dates[0] ?? "";
	});
	const agg = $derived(data?.aggregate);
	const pct = (n: number) =>
		agg && agg.count ? Math.round((n / agg.count) * 100) : 0;

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!outcome || !date) {
			formError = "choose";
			return;
		}
		sending = true;
		formError = null;
		try {
			await api.submitReview({
				street: street.slug,
				segment: app.selectedSegment,
				date,
				outcome,
				rating: outcome === "skipped" || !rating ? null : rating,
				note: note.trim() || null,
				signFrom: signDiffers ? toMinutes(signFrom) : null,
				signTo: signDiffers ? toMinutes(signTo) : null,
				website,
			});
			sent = true;
			app.announce(m.thanks);
			data = await api.reviews(street.slug);
		} catch (e) {
			formError = errorCode(e);
		} finally {
			sending = false;
		}
	}
</script>

<section class="space-y-5 pt-1">
	<p class="text-sm">{m.intro}</p>

	{#if loadError}
		<p class="text-sm" role="alert">{prefs.m.errors[loadError]}</p>
	{:else if !data}
		<p class="text-sm text-muted">{prefs.m.common.loading}</p>
	{:else if !data.enabled}
		<p class="card p-4 text-sm">{m.disabled}</p>
	{:else}
		{#if agg && agg.count > 0}
			<div class="card p-4">
				<p class="text-sm">
					<strong>{m.lastMonths(agg.count)}</strong
					>{#if agg.ratingAverage !== null}{" · "}{m.averageQuality(
							f.decimal(agg.ratingAverage)
						)}{/if}
				</p>
				<ul class="mt-3 space-y-2" aria-label={m.outcomesLabel}>
					{#each REVIEW_OUTCOMES as key (key)}
						<li
							class="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-2 text-xs"
						>
							<span>{m.outcomes[key].label}</span>
							<span
								class="h-2 overflow-hidden rounded-full bg-surface-2"
								aria-hidden="true"
							>
								<span
									class="block h-full rounded-full {key ===
									'clean'
										? 'bg-ok'
										: key === 'partial'
											? 'bg-tone-tomorrow-fg'
											: 'bg-primary'}"
									style:width="{pct(agg.outcomes[key])}%"
								></span>
							</span>
							<span class="text-right tabular-nums"
								>{pct(agg.outcomes[key])}%</span
							>
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<p class="text-sm text-muted">{m.empty}</p>
		{/if}

		{#if sent}
			<p
				class="rounded-xl bg-surface-2 p-4 text-sm font-medium"
				role="status"
			>
				{m.thanks}
			</p>
		{:else if dates.length === 0}
			<p class="card p-4 text-sm">{m.notYet}</p>
		{:else}
			<form class="space-y-5" onsubmit={submit} novalidate>
				{#if dates.length > 1}
					<fieldset>
						<legend class="mb-1.5 text-sm font-semibold"
							>{m.whichPass}</legend
						>
						<div class="flex flex-wrap gap-2">
							{#each dates as d (d)}
								<label
									class="flex min-h-11 cursor-pointer items-center gap-2 card px-3 text-sm has-checked:border-accent has-checked:ring-2 has-checked:ring-accent"
								>
									<input
										type="radio"
										name="date"
										value={d}
										bind:group={date}
										class="accent-accent"
									/>
									{f.shortDate(parseIsoDate(d))}
								</label>
							{/each}
						</div>
					</fieldset>
				{:else}
					<p class="text-sm">
						{m.passOf(
							f.longDate(parseIsoDate(date))
						)}{app.selectedSegment ? ` · ${m.segmentScope}` : ""}
					</p>
				{/if}

				<fieldset>
					<legend class="mb-1.5 text-sm font-semibold">{m.how}</legend
					>
					<div class="grid gap-2">
						{#each REVIEW_OUTCOMES as key (key)}
							<label
								class="flex cursor-pointer items-start gap-3 card p-3 has-checked:border-accent has-checked:ring-2 has-checked:ring-accent"
							>
								<input
									type="radio"
									name="outcome"
									value={key}
									bind:group={outcome}
									class="mt-1 accent-accent"
								/>
								<span
									><span class="block text-sm font-medium"
										>{m.outcomes[key].label}</span
									><span class="block text-xs text-muted"
										>{m.outcomes[key].hint}</span
									></span
								>
							</label>
						{/each}
					</div>
				</fieldset>

				{#if outcome && outcome !== "skipped"}
					<fieldset>
						<legend class="mb-1 text-sm font-semibold"
							>{m.quality}
							<span class="font-normal text-muted"
								>{m.optional}</span
							></legend
						>
						<div class="flex gap-1">
							{#each [1, 2, 3, 4, 5] as n (n)}
								<label
									class="grid size-11 cursor-pointer place-items-center rounded-lg {n <=
									rating
										? 'text-primary-text'
										: 'text-muted'}"
								>
									<input
										type="radio"
										name="rating"
										value={n}
										bind:group={rating}
										class="peer sr-only"
									/>
									<span
										class="rounded-md peer-focus-visible:outline-3 peer-focus-visible:outline-accent"
									>
										<Icon
											name="star"
											size={26}
											class={n <= rating
												? "fill-current"
												: ""}
										/>
									</span>
									<span class="sr-only">{m.stars(n)}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}

				<div>
					<label
						for="review-note"
						class="mb-1 block text-sm font-semibold"
						>{m.note}
						<span class="font-normal text-muted">{m.optional}</span
						></label
					>
					<textarea
						id="review-note"
						bind:value={note}
						maxlength="280"
						rows="3"
						class="w-full rounded-lg border border-border bg-surface p-2 text-sm"
						aria-describedby="note-count"></textarea>
					<p id="note-count" class="text-right text-xs text-muted">
						{note.length}/280 · {m.noteHint}
					</p>
				</div>

				<fieldset class="space-y-2 card p-3">
					<label class="flex items-start gap-3 text-sm font-medium">
						<input
							type="checkbox"
							bind:checked={signDiffers}
							class="mt-0.5 size-4 accent-accent"
						/>
						{m.signMismatch}
					</label>
					{#if signDiffers}
						<div class="grid grid-cols-2 gap-2 pl-7">
							<label class="text-xs text-muted">
								{m.signFrom}
								<input
									type="time"
									bind:value={signFrom}
									step="900"
									class="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
								/>
							</label>
							<label class="text-xs text-muted">
								{m.signTo}
								<input
									type="time"
									bind:value={signTo}
									step="900"
									class="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm text-text"
								/>
							</label>
						</div>
					{/if}
				</fieldset>

				<!-- Honeypot for bots: hidden from people and assistive tech -->
				<div class="hidden" aria-hidden="true">
					<label
						>{m.honeypot}
						<input
							type="text"
							name="website"
							bind:value={website}
							tabindex="-1"
							autocomplete="off"
						/></label
					>
				</div>

				{#if formError}<p
						class="text-sm font-medium text-primary-text"
						role="alert"
					>
						{formError === "choose"
							? m.chooseOutcome
							: prefs.m.errors[formError]}
					</p>{/if}
				<button
					type="submit"
					class="btn-primary w-full"
					disabled={sending}>{sending ? m.sending : m.send}</button
				>
			</form>
		{/if}

		{#if data.reviews.length}
			<div>
				<h3 class="mb-1 font-sans text-sm font-semibold">
					{m.latest}
				</h3>
				<ul class="divide-y divide-border text-sm">
					{#each data.reviews.slice(0, 5) as r (r.id)}
						<li class="py-2">
							<span class="font-medium"
								>{m.outcomes[r.outcome].label}</span
							>
							{#if r.rating}<span class="text-muted">
									· {r.rating}/5</span
								>{/if}
							<span class="text-muted">
								· {f.shortDate(parseIsoDate(r.date))}</span
							>
							{#if r.signWindow}<p class="mt-0.5 text-muted">
									{m.signOnReview(
										f.timeWindow(
											r.signWindow.from,
											r.signWindow.to
										)
									)}
								</p>{/if}
							{#if r.note}<p class="mt-0.5 text-muted">
									“{r.note}”
								</p>{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}

	<section
		aria-labelledby="where-title"
		class="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm"
	>
		<h3 id="where-title" class="font-sans font-semibold">
			{m.whereTitle}
		</h3>
		<p>{m.where}</p>
	</section>

	<section
		aria-labelledby="official-title"
		class="space-y-3 card p-4 text-sm"
	>
		<h3 id="official-title" class="font-sans font-semibold">
			{m.officialTitle}
		</h3>
		<p class="text-muted">{m.officialText}</p>
		<ul class="space-y-3">
			<li>
				<p class="font-semibold">{OFFICIAL_CHANNELS.alia.name}</p>
				<p>
					<a
						class="text-primary-text underline"
						href="tel:{OFFICIAL_CHANNELS.alia.phoneLandline.replace(
							/\s/g,
							''
						)}"
						>{m.callLandline(
							OFFICIAL_CHANNELS.alia.phoneLandline
						)}</a
					>
				</p>
				<p>
					<a
						class="text-primary-text underline"
						href="tel:{OFFICIAL_CHANNELS.alia.phoneMobile.replace(
							/\s/g,
							''
						)}"
						>{m.callMobile(OFFICIAL_CHANNELS.alia.phoneMobile)}</a
					>
					·
					<span class="text-muted"
						>{OFFICIAL_CHANNELS.alia.hours}</span
					>
				</p>
				<p>
					<a
						class="text-primary-text underline"
						href={OFFICIAL_CHANNELS.alia.url}
						target="_blank"
						rel="noopener noreferrer"
						>{m.openForm}<span class="sr-only">
							{prefs.m.common.newTab}</span
						></a
					>
				</p>
			</li>
			<li>
				<p class="font-semibold">{OFFICIAL_CHANNELS.comune.name}</p>
				<p>
					<a
						class="text-primary-text underline"
						href="tel:{OFFICIAL_CHANNELS.comune.phone.replace(
							/\s/g,
							''
						)}">{OFFICIAL_CHANNELS.comune.phone}</a
					>
					·
					<a
						class="text-primary-text underline"
						href={OFFICIAL_CHANNELS.comune.url}
						target="_blank"
						rel="noopener noreferrer"
						>{m.openForm}<span class="sr-only">
							{prefs.m.common.newTab}</span
						></a
					>
				</p>
			</li>
		</ul>
	</section>
</section>
