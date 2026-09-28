import { getContext, setContext } from 'svelte';
import type { CleaningWindowDto, OccurrenceDto, StreetDetailDto } from '$lib/api/contracts';
import { parseIsoDate, toIsoDate } from '$lib/domain/civil-date';
import type { AppState } from './app-state.svelte';
import type { Preferences } from './preferences.svelte';

export interface LastDone {
	/** 0 = today, 1 = yesterday. */
	ago: 0 | 1;
	occurrence: OccurrenceDto;
	scope: string | null;
}

/**
 * View-model of the selected street, shared by every screen of the street
 * sheet: which schedule group is in focus, what is still to come, how to
 * name each stretch of road. Pure derivations of app state + preferences.
 */
export class StreetModel {
	constructor(
		private readonly app: AppState,
		private readonly prefs: Preferences
	) {}

	readonly street: StreetDetailDto | null = $derived.by(() => this.app.selected);
	/** Schedule group in focus (user's segment), or -1 for the whole street. */
	readonly focus: number = $derived.by(() => this.app.selectedGroup);
	readonly multiGroup: boolean = $derived((this.street?.groups.length ?? 0) > 1);

	/** Occurrences not over yet, by the client clock. */
	readonly upcoming: OccurrenceDto[] = $derived.by(() => {
		const street = this.street;
		if (!street) return [];
		const today = toIsoDate(this.app.clock.now.day);
		return street.upcoming.filter((o) => o.date !== today || o.end > this.app.clock.now.minute);
	});

	/** Upcoming occurrences relevant to the focused group (or all). */
	readonly focusUpcoming: OccurrenceDto[] = $derived(
		this.focus >= 0 ? this.upcoming.filter((o) => o.groups.includes(this.focus)) : this.upcoming
	);

	readonly next: CleaningWindowDto | null = $derived.by(() => {
		const street = this.street;
		if (!street) return null;
		return this.focusUpcoming[0] ?? (this.focus >= 0 ? (street.groups[this.focus]?.next ?? null) : street.next);
	});


	/** A sweep done today or yesterday (focused group if any): worth verifying. */
	readonly lastDone: LastDone | null = $derived.by(() => {
		const street = this.street;
		// `recent` may be missing in responses cached from a previous deploy.
		const occurrence = (street?.recent ?? []).find((r) => this.focus < 0 || r.groups.includes(this.focus));
		if (!occurrence) return null;
		const ago = this.app.clock.now.day - parseIsoDate(occurrence.date);
		if (ago !== 0 && ago !== 1) return null;
		const scope = !this.multiGroup || this.focus >= 0 || occurrence.wholeStreet ? null : this.scopeOf(occurrence);
		return { ago, occurrence, scope };
	});

	readonly totalLength: number = $derived(this.street?.sections.reduce((n, s) => n + s.lengthMeters, 0) ?? 0);

	groupLabel(index: number): string {
		const street = this.street;
		const g = street?.groups[index];
		if (!street || !g) return '';
		// The end streets identify the stretch; a "Part n" prefix would only repeat it.
		return this.prefs.f.between(g.between, index);
	}

	scopeOf(o: OccurrenceDto): string {
		return o.wholeStreet ? this.prefs.m.street.wholeStreet : o.groups.map((g) => this.groupLabel(g)).join(' · ');
	}

	groupNext(index: number): CleaningWindowDto | null {
		return this.upcoming.find((o) => o.groups.includes(index)) ?? this.street?.groups[index]?.next ?? null;
	}
}

const KEY = Symbol('street-model');

export function provideStreetModel(app: AppState, prefs: Preferences): StreetModel {
	return setContext(KEY, new StreetModel(app, prefs));
}

export function useStreetModel(): StreetModel {
	return getContext<StreetModel>(KEY);
}
