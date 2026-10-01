<script lang="ts">
	import type {
		AlarmOption,
		CalendarMode,
		StreetDetailDto,
	} from "$lib/api/contracts";
	import { api } from "$lib/client/api";
	import { useAppState } from "$lib/client/app-state.svelte";
	import { usePreferences } from "$lib/client/preferences.svelte";
	import {
		formatMinutes,
		parseIsoDate,
		toIsoDate,
	} from "$lib/domain/civil-date";
	import { icsLocalStamp, recurrencesFor } from "$lib/domain/recurrence";
	import { romeLocalToEpochMs, TIME_ZONE } from "$lib/domain/rome-clock";
	import { alarmWallTime } from "$lib/domain/reminder";
	import { useStreetModel } from "$lib/client/street-model.svelte";
	import Icon from "./Icon.svelte";

	/**
	 * Reminder screen of the street sheet: choose where (the user's stretch or the whole street),
	 * how (recurring events, the next sweep only, or a live feed that updates
	 * itself) and when to be alerted, then pick the calendar app.
	 */
	let { street }: { street: StreetDetailDto } = $props();
	const app = useAppState();
	const prefs = usePreferences();
	const model = useStreetModel();
	const group = $derived(model.focus);
	const groupLabel = (index: number) => model.groupLabel(index);
	const uid = $props.id();
	const m = $derived(prefs.m.reminder);

	let alarm = $state<AlarmOption>("auto");
	let onlyGroup = $state(true);
	let mode = $state<CalendarMode>("repeat");
	const scopedToGroup = $derived(
		group >= 0 && street.groups.length > 1 && onlyGroup
	);
	const segment = $derived(
		scopedToGroup
			? (street.segments.find((s) => s.group === group)?.code ?? null)
			: null
	);

	const OPTIONS: {
		value: AlarmOption;
		label: () => string;
		hint?: () => string;
	}[] = [
		{ value: "auto", label: () => m.auto, hint: () => m.autoHint },
		{ value: "evening", label: () => m.evening, hint: () => m.eveningHint },
		{ value: "120", label: () => m.h2 },
		{ value: "60", label: () => m.h1 },
		{ value: "none", label: () => m.none },
	];

	const MODES: {
		value: CalendarMode;
		label: () => string;
		hint: () => string;
	}[] = [
		{
			value: "repeat",
			label: () => m.modeRepeat,
			hint: () => m.modeRepeatHint,
		},
		{ value: "next", label: () => m.modeNext, hint: () => m.modeNextHint },
		{ value: "feed", label: () => m.modeFeed, hint: () => m.modeFeedHint },
	];

	const origin = () =>
		typeof window === "undefined" ? "" : window.location.origin;
	const path = $derived(
		api.calendarPath(street.slug, {
			segment,
			alarm,
			lang: prefs.locale,
			mode,
		})
	);
	const httpsUrl = $derived(
		new URL(path, origin() || "http://localhost").href
	);
	const webcalUrl = $derived(httpsUrl.replace(/^https?:/, "webcal:"));

	/** Sweeps in the chosen scope that have not ended yet. */
	const pending = $derived.by(() => {
		const { day: today, minute } = app.clock.now;
		const todayIso = toIsoDate(today);
		return street.upcoming.filter(
			(o) =>
				(!scopedToGroup || o.groups.includes(group)) &&
				!(o.date === todayIso && o.end <= minute)
		);
	});
	const next = $derived(pending[0] ?? null);

	/** First future reminder: of the next sweep only, or of the whole feed. */
	const nextAlert = $derived.by(() => {
		const { day: today, minute } = app.clock.now;
		for (const o of mode === "next" ? pending.slice(0, 1) : pending) {
			const wall = alarmWallTime(alarm, parseIsoDate(o.date), o.from);
			if (!wall) return null;
			if (
				wall.day > today ||
				(wall.day === today && wall.minute > minute)
			) {
				return `${prefs.f.longDate(wall.day)} · ${formatMinutes(wall.minute)}`;
			}
		}
		return null;
	});

	const rules = $derived(
		scopedToGroup ? street.groups[group]!.rules : street.rules
	);
	/** One recurring event per rule part, as in the server ICS (`modo=repeat`). */
	const recurrences = $derived(
		recurrencesFor(rules, app.clock.now.day, app.clock.now.minute)
	);

	const pageUrl = $derived.by(() => {
		const page = new URL("/", origin() || "http://localhost");
		page.searchParams.set("strada", street.slug);
		if (segment) page.searchParams.set("tratto", segment);
		return page.href;
	});
	const summary = $derived(
		prefs.m.ics.summary(
			scopedToGroup
				? prefs.m.ics.segmentTitle(street.name, groupLabel(group))
				: street.name
		)
	);
	const location = $derived(prefs.m.ics.location(street.name));

	/** The next sweep, mirroring the server ICS event (`modo=next`). */
	const event = $derived.by(() => {
		if (!next) return null;
		const ics = prefs.m.ics;
		const inGroup = scopedToGroup
			? new Set(
					street.segments
						.filter((s) => s.group === group)
						.map((s) => s.code)
				)
			: null;
		const swept = inGroup
			? next.segments.filter((c) => inGroup.has(c)).length
			: next.segments.length;
		const total = inGroup?.size ?? street.segments.length;
		const day = parseIsoDate(next.date);
		return {
			details: [
				ics.time(
					prefs.f.timeWindow(next.from, next.to),
					swept === total ? ics.scopeAll : ics.scopeSome(swept, total)
				),
				ics.noParking,
				ics.details(pageUrl),
			].join("\n"),
			start: icsLocalStamp(day, next.from),
			end: icsLocalStamp(day, next.end),
			when: `${prefs.f.longDate(day)} · ${prefs.f.timeWindow(next.from, next.to)}`,
		};
	});

	/** Google takes one event per link: recurring only when the scope has a single rule. */
	const googleUrl = $derived.by(() => {
		if (mode === "feed")
			return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
		const base = {
			action: "TEMPLATE",
			text: summary,
			location,
			ctz: TIME_ZONE,
		};
		if (mode === "next") {
			if (!event) return null;
			return `https://calendar.google.com/calendar/render?${new URLSearchParams({ ...base, dates: `${event.start}/${event.end}`, details: event.details })}`;
		}
		const r = recurrences.length === 1 ? recurrences[0]! : null;
		if (!r) return null;
		const details = [
			prefs.f.rule(r.rule),
			prefs.m.ics.noParking,
			prefs.m.ics.details(pageUrl),
		].join("\n");
		const dates = `${icsLocalStamp(r.day, r.from)}/${icsLocalStamp(r.day, r.end)}`;
		return `https://calendar.google.com/calendar/render?${new URLSearchParams({ ...base, dates, details, recur: `RRULE:${r.rrule}` })}`;
	});
	/** Outlook's compose link has no recurrence: only the next sweep or the feed. */
	const outlookUrl = $derived.by(() => {
		if (mode === "feed")
			return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(street.name)}`;
		if (mode === "repeat" || !event || !next) return null;
		const day = parseIsoDate(next.date);
		const iso = (minute: number) =>
			new Date(romeLocalToEpochMs(day, minute)).toISOString();
		const q = new URLSearchParams({
			path: "/calendar/action/compose",
			rru: "addevent",
			subject: summary,
			startdt: iso(next.from),
			enddt: iso(next.end),
			body: event.details,
			location,
		});
		return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
	});
	/** Apple opens a one-off .ics as "add event(s)"; a feed needs webcal to subscribe. */
	const appleUrl = $derived(mode === "feed" ? webcalUrl : path);
	const ready = $derived(
		mode === "feed" ||
			(mode === "next" ? next !== null : recurrences.length > 0)
	);
	/** Why an app is missing in repeat mode, if it is. */
	const repeatNotes = $derived(
		mode !== "repeat"
			? []
			: [...(googleUrl ? [] : [m.repeatGoogleMany]), m.repeatOutlook]
	);

	let copied = $state(false);
	async function copy(): Promise<void> {
		await navigator.clipboard.writeText(httpsUrl);
		copied = true;
		app.announce(prefs.m.common.linkCopied);
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="space-y-5 pt-1">
	<p class="text-sm text-muted">{m.subtitle}</p>

	{#if group >= 0 && street.groups.length > 1}
		<div
			class="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1"
			role="radiogroup"
			aria-label={prefs.m.street.schedulesTitle}
		>
			<button
				type="button"
				role="radio"
				aria-checked={onlyGroup}
				class="rounded-lg px-2 py-2 text-xs font-semibold {onlyGroup
					? 'bg-surface shadow-sm'
					: 'text-muted'}"
				onclick={() => (onlyGroup = true)}
			>
				{m.scopeSegment}<span class="block font-normal text-muted"
					>{groupLabel(group)}</span
				>
			</button>
			<button
				type="button"
				role="radio"
				aria-checked={!onlyGroup}
				class="rounded-lg px-2 py-2 text-xs font-semibold {!onlyGroup
					? 'bg-surface shadow-sm'
					: 'text-muted'}"
				onclick={() => (onlyGroup = false)}
			>
				{m.scopeStreet}
			</button>
		</div>
	{/if}

	<fieldset>
		<legend class="mb-2 text-sm font-semibold">{m.modeTitle}</legend>
		<div
			class="divide-y divide-border overflow-hidden rounded-xl bg-surface-2"
		>
			{#each MODES as option (option.value)}
				<label
					class="flex cursor-pointer items-start gap-3 p-3 -outline-offset-2 has-checked:bg-primary/10 has-focus-visible:outline-2 has-focus-visible:outline-accent"
				>
					<input
						type="radio"
						class="mt-0.5 size-5 shrink-0 accent-primary"
						name="{uid}-mode"
						value={option.value}
						bind:group={mode}
						aria-describedby="{uid}-mode-{option.value}"
					/>
					<span class="text-sm"
						><span class="block font-semibold"
							>{option.label()}</span
						><span
							id="{uid}-mode-{option.value}"
							class="block text-xs text-muted"
							>{option.hint()}</span
						></span
					>
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend class="mb-2 text-sm font-semibold">{m.when}</legend>
		<div class="flex flex-wrap gap-1.5">
			{#each OPTIONS as option (option.value)}
				<label
					class="cursor-pointer rounded-full border border-border px-3 py-2 text-sm hover:bg-surface-2 has-checked:border-primary has-checked:bg-primary has-checked:font-semibold has-checked:text-on-primary has-focus-visible:outline-2 has-focus-visible:outline-accent"
				>
					<input
						type="radio"
						class="sr-only"
						name="{uid}-alarm"
						value={option.value}
						bind:group={alarm}
					/>
					{option.label()}{#if option.hint}<span class="sr-only"
							>: {option.hint()}</span
						>{/if}
				</label>
			{/each}
		</div>
		{#if alarm === "auto"}<p class="mt-2 text-xs text-muted">
				{m.autoHint}
			</p>{/if}
	</fieldset>

	{#if mode !== "feed" || nextAlert}
		<div
			class="space-y-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-sm"
			aria-live="polite"
		>
			{#if mode === "next"}
				<p class="flex items-center gap-2">
					<Icon
						name="calendar"
						size={16}
						class="shrink-0 text-primary-text"
					/>{event ? m.nextEvent(event.when) : m.noUpcoming}
				</p>
			{:else if mode === "repeat"}
				{#each rules as rule, i (i)}
					<p class="flex items-center gap-2">
						<Icon
							name="calendar"
							size={16}
							class="shrink-0 text-primary-text"
						/>{m.repeats(prefs.f.rule(rule))}
					</p>
				{:else}
					<p>{m.noUpcoming}</p>
				{/each}
			{/if}
			{#if nextAlert}
				<p class="flex items-center gap-2">
					<Icon
						name="bell"
						size={16}
						class="shrink-0 text-primary-text"
					/>{m.nextAlert(nextAlert)}
				</p>
			{/if}
		</div>
	{/if}

	{#if ready}
		<section aria-labelledby="{uid}-apps">
			<h3 id="{uid}-apps" class="mb-2 font-sans text-sm font-semibold">
				{m.add}
			</h3>
			<div class="grid grid-cols-2 gap-2">
				<a class="btn-primary px-3" href={appleUrl}
					><Icon name="calendar" />{m.apple}</a
				>
				{#if googleUrl}
					<a
						class="btn-primary px-3"
						href={googleUrl}
						target="_blank"
						rel="noopener noreferrer"
						><Icon name="calendar" />{m.google}<span class="sr-only"
							>{prefs.m.common.newTab}</span
						></a
					>
				{/if}
				{#if outlookUrl}
					<a
						class="btn-primary px-3"
						href={outlookUrl}
						target="_blank"
						rel="noopener noreferrer"
						><Icon name="calendar" />{m.outlook}<span
							class="sr-only">{prefs.m.common.newTab}</span
						></a
					>
				{/if}
				<a class="btn-primary px-3" href={path} download
					><Icon name="download" />{m.download}</a
				>
			</div>
			{#if mode === "feed"}
				<button
					type="button"
					class="mt-2 btn-ghost w-full"
					onclick={copy}
				>
					<Icon name={copied ? "check" : "copy"} />{copied
						? prefs.m.common.copied
						: prefs.m.common.copyLink}
				</button>
			{:else}
				{#each repeatNotes as note (note)}<p
						class="mt-2 text-xs text-muted"
					>
						{note}
					</p>{/each}
				{#if alarm !== "none" && (googleUrl || outlookUrl)}<p
						class="mt-2 text-xs text-muted"
					>
						{m.defaultAlarm}
					</p>{/if}
			{/if}
		</section>
	{/if}
</div>
