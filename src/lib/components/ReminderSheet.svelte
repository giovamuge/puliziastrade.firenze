<script lang="ts">
	import type { AlarmOption, StreetDetailDto } from '$lib/api/contracts';
	import { api } from '$lib/client/api';
	import { useAppState } from '$lib/client/app-state.svelte';
	import { usePreferences } from '$lib/client/preferences.svelte';
	import { formatMinutes, parseIsoDate, toIsoDate } from '$lib/domain/civil-date';
	import { alarmWallTime } from '$lib/domain/reminder';
	import { useStreetModel } from '$lib/client/street-model.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	/**
	 * Reminder sheet: choose what (the user's stretch or the whole street) and
	 * when to be alerted, see the next alert, then pick the calendar app.
	 * The feed is a live subscription that updates itself.
	 */
	let { street }: { street: StreetDetailDto } = $props();
	const app = useAppState();
	const prefs = usePreferences();
	const model = useStreetModel();
	const group = $derived(model.focus);
	const groupLabel = (index: number) => model.groupLabel(index);
	const uid = $props.id();
	const m = $derived(prefs.m.reminder);

	let alarm = $state<AlarmOption>('auto');
	let onlyGroup = $state(true);
	const scopedToGroup = $derived(group >= 0 && street.groups.length > 1 && onlyGroup);
	const segment = $derived(scopedToGroup ? street.segments.find((s) => s.group === group)?.code ?? null : null);

	const OPTIONS: { value: AlarmOption; label: () => string; hint?: () => string }[] = [
		{ value: 'auto', label: () => m.auto, hint: () => m.autoHint },
		{ value: 'evening', label: () => m.evening, hint: () => m.eveningHint },
		{ value: '120', label: () => m.h2 },
		{ value: '60', label: () => m.h1 },
		{ value: 'none', label: () => m.none }
	];

	const path = $derived(api.calendarPath(street.slug, { segment, alarm, lang: prefs.locale }));
	const httpsUrl = $derived(typeof window === 'undefined' ? path : new URL(path, window.location.origin).href);
	const webcalUrl = $derived(httpsUrl.replace(/^https?:/, 'webcal:'));
	const googleUrl = $derived(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`);
	const outlookUrl = $derived(
		`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(street.name)}`
	);

	/** First future reminder for the chosen scope and timing. */
	const nextAlert = $derived.by(() => {
		const { day: today, minute } = app.clock.now;
		const todayIso = toIsoDate(today);
		for (const o of street.upcoming) {
			if (scopedToGroup && !o.groups.includes(group)) continue;
			if (o.date === todayIso && o.end <= minute) continue;
			const wall = alarmWallTime(alarm, parseIsoDate(o.date), o.from);
			if (!wall) return null;
			if (wall.day > today || (wall.day === today && wall.minute > minute)) {
				return `${prefs.f.longDate(wall.day)} · ${formatMinutes(wall.minute)}`;
			}
		}
		return null;
	});

	let copied = $state(false);
	async function copy(): Promise<void> {
		await navigator.clipboard.writeText(httpsUrl);
		copied = true;
		app.announce(prefs.m.common.linkCopied);
		setTimeout(() => (copied = false), 2000);
	}
</script>

<Sheet open={app.subSheet === 'reminder'} onclose={() => app.closeSubSheet()} labelledby="{uid}-title" variant="sub" snaps={['100%', '78%']} initial={1}>
	{#snippet header()}
		<div class="flex items-center gap-3 py-1">
			<span class="bg-primary text-on-primary grid size-11 shrink-0 place-items-center rounded-xl"><Icon name="bell" /></span>
			<div class="min-w-0 flex-1">
				<h2 id="{uid}-title" class="text-xl leading-tight font-semibold outline-none" tabindex="-1">{m.title}</h2>
				<p class="text-muted truncate text-sm">{street.name}</p>
			</div>
			<button type="button" class="btn-ghost size-10 min-h-10 shrink-0 px-0" onclick={() => app.closeSubSheet()} aria-label={prefs.m.common.close}>
				<Icon name="close" />
			</button>
		</div>
	{/snippet}

	<div class="space-y-5 pt-1">
		<p class="text-muted text-sm">{m.subtitle}</p>

		{#if group >= 0 && street.groups.length > 1}
			<div class="bg-surface-2 grid grid-cols-2 gap-1 rounded-xl p-1" role="radiogroup" aria-label={prefs.m.street.schedulesTitle}>
				<button type="button" role="radio" aria-checked={onlyGroup} class="rounded-lg px-2 py-2 text-xs font-semibold {onlyGroup ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => (onlyGroup = true)}>
					{m.scopeSegment}<span class="text-muted block font-normal">{groupLabel(group)}</span>
				</button>
				<button type="button" role="radio" aria-checked={!onlyGroup} class="rounded-lg px-2 py-2 text-xs font-semibold {!onlyGroup ? 'bg-surface shadow-sm' : 'text-muted'}" onclick={() => (onlyGroup = false)}>
					{m.scopeStreet}
				</button>
			</div>
		{/if}

		<fieldset>
			<legend class="mb-2 text-sm font-semibold">{m.when}</legend>
			<div class="flex flex-wrap gap-1.5">
				{#each OPTIONS as option (option.value)}
					<label class="has-checked:bg-text has-checked:text-bg has-checked:border-text border-border hover:bg-surface-2 has-focus-visible:outline-accent cursor-pointer rounded-full border px-3 py-2 text-sm has-focus-visible:outline-2">
						<input type="radio" class="sr-only" name="{uid}-alarm" value={option.value} bind:group={alarm} />
						{option.label()}{#if option.hint}<span class="sr-only">: {option.hint()}</span>{/if}
					</label>
				{/each}
			</div>
			{#if alarm === 'auto'}<p class="text-muted mt-2 text-xs">{m.autoHint}</p>{/if}
		</fieldset>

		{#if nextAlert}
			<p class="bg-surface-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" aria-live="polite">
				<Icon name="bell" size={16} class="text-primary-text shrink-0" />{m.nextAlert(nextAlert)}
			</p>
		{/if}

		<section aria-labelledby="{uid}-apps">
			<h3 id="{uid}-apps" class="mb-2 font-sans text-sm font-semibold">{m.add}</h3>
			<ul class="card divide-border divide-y overflow-hidden">
				<li>
					<a class="hover:bg-surface-2 flex items-center gap-3 p-3" href={webcalUrl}>
						<Icon name="calendar" /><span class="flex-1"><span class="block font-semibold">{m.apple}</span><span class="text-muted block text-xs">{m.appleHint}</span></span><Icon name="chevron" class="text-muted" />
					</a>
				</li>
				<li>
					<a class="hover:bg-surface-2 flex items-center gap-3 p-3" href={googleUrl} target="_blank" rel="noopener noreferrer">
						<Icon name="external" /><span class="flex-1 font-semibold">{m.google}</span><span class="sr-only">{prefs.m.common.newTab}</span><Icon name="chevron" class="text-muted" />
					</a>
				</li>
				<li>
					<a class="hover:bg-surface-2 flex items-center gap-3 p-3" href={outlookUrl} target="_blank" rel="noopener noreferrer">
						<Icon name="external" /><span class="flex-1 font-semibold">{m.outlook}</span><span class="sr-only">{prefs.m.common.newTab}</span><Icon name="chevron" class="text-muted" />
					</a>
				</li>
				<li>
					<a class="hover:bg-surface-2 flex items-center gap-3 p-3" href={path} download>
						<Icon name="download" /><span class="flex-1 font-semibold">{m.download}</span>
					</a>
				</li>
				<li>
					<button type="button" class="hover:bg-surface-2 flex w-full items-center gap-3 p-3 text-left" onclick={copy}>
						<Icon name={copied ? 'check' : 'copy'} /><span class="flex-1 font-semibold">{copied ? prefs.m.common.copied : prefs.m.common.copyLink}</span>
					</button>
				</li>
			</ul>
		</section>
	</div>
</Sheet>
