import { getContext, setContext } from "svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/state";
import type {
	ApiErrorCode,
	NearbyResponse,
	StreetDetailDto,
} from "$lib/api/contracts";
import type { Messages } from "$lib/i18n";
import { api, errorCode } from "./api";
import { RomeClock } from "./clock.svelte";

export type MapMode = "urgency" | "day" | "reviews";
export type LocateStatus = "idle" | "locating" | "done" | "error";
/** Screens inside the street sheet. */
export type StreetView =
	"overview" | "schedule" | "upcoming" | "nearby" | "technical";
/** Sheets stacked on top of the street sheet. */
export type SubSheet = "reminder" | "verify";
export type LocateError = keyof Pick<
	Messages["locate"],
	| "unsupported"
	| "denied"
	| "unavailable"
	| "noneNearby"
	| "outside"
	| "failed"
>;

export interface UserPosition {
	lat: number;
	lon: number;
	accuracy: number;
}

/** Rough bounding box of the municipality, to explain empty results outside Florence. */
const FLORENCE_BBOX = { west: 11.14, south: 43.72, east: 11.34, north: 43.84 };

/**
 * Application state (single source of truth). Components read reactive fields
 * and call intent methods; network access goes through the typed `api`.
 * The street sheet has its own screens (`view`); reminder and verification
 * open as separate sheets stacked on top (`subSheet`).
 */
export class AppState {
	readonly clock = new RomeClock();

	selected = $state<StreetDetailDto | null>(null);
	/** A segment (`cod_arco`) of the selected street: focuses its schedule group. */
	selectedSegment = $state<string | null>(null);
	streetStatus = $state<"idle" | "loading" | "error">("idle");
	streetError = $state<ApiErrorCode | null>(null);

	nearby = $state<NearbyResponse | null>(null);
	locateStatus = $state<LocateStatus>("idle");
	locateError = $state<LocateError | null>(null);
	position = $state<UserPosition | null>(null);

	mapMode = $state<MapMode>("urgency");
	/** Day shown in the "day" map mode, as offset from today (0–6). */
	dayOffset = $state(0);
	/** Per-legend-entry segment counts, published by the map. */
	mapCounts = $state<number[]>([]);

	view = $state<StreetView>("overview");
	/** The street was opened by tapping a basemap road that is not among its mapped segments. */
	unmappedTap = $state(false);
	subSheet = $state<SubSheet | null>(null);
	/** Polite screen-reader announcements. */
	announcement = $state("");

	/** Index of the schedule group of the selected segment, or -1. */
	readonly selectedGroup: number = $derived.by(() => {
		if (!this.selected || !this.selectedSegment) return -1;
		return (
			this.selected.segments.find((s) => s.code === this.selectedSegment)
				?.group ?? -1
		);
	});
	readonly sheetOpen: boolean = $derived(
		this.selected !== null || this.streetStatus !== "idle"
	);

	private streetRequest: AbortController | null = null;
	/**
	 * The current street was selected by "my position" (not search, map or URL): the map
	 * keeps the user in view instead of framing the street. Not reactive on purpose.
	 */
	selectedByLocate = false;

	async selectStreet(
		slug: string,
		segment: string | null = null,
		announce?: (name: string) => string,
		byLocate = false
	): Promise<void> {
		this.streetRequest?.abort();
		const controller = (this.streetRequest = new AbortController());
		this.selectedByLocate = byLocate;
		this.selectedSegment = segment;
		this.unmappedTap = false;
		if (this.selected?.slug === slug) {
			this.syncUrl();
			return;
		}
		this.streetStatus = "loading";
		this.streetError = null;
		this.view = "overview";
		this.subSheet = null;
		try {
			const detail = await api.street(slug, controller.signal);
			if (controller.signal.aborted) return;
			this.selected = detail;
			this.streetStatus = "idle";
			if (announce) this.announce(announce(detail.name));
			this.syncUrl();
		} catch (error) {
			if ((error as Error).name === "AbortError") return;
			this.streetStatus = "error";
			this.streetError = errorCode(error);
		}
	}

	selectGroup(group: number): void {
		const code =
			this.selected?.segments.find((s) => s.group === group)?.code ??
			null;
		this.selectedSegment = code;
		this.view = "overview";
		this.syncUrl();
	}

	clearSelection(): void {
		this.streetRequest?.abort();
		this.selected = null;
		this.selectedSegment = null;
		this.streetStatus = "idle";
		this.view = "overview";
		this.subSheet = null;
		this.syncUrl();
	}

	openSubSheet(sheet: SubSheet): void {
		this.subSheet = sheet;
	}

	closeSubSheet(): void {
		this.subSheet = null;
	}

	/** One tap: device position → nearest streets → select the closest one. */
	locate(messages: () => Messages): void {
		if (!("geolocation" in navigator))
			return this.fail("unsupported", messages);
		this.locateStatus = "locating";
		this.locateError = null;
		this.announce(messages().locate.locating);
		navigator.geolocation.getCurrentPosition(
			(pos) =>
				void this.onPosition(
					{
						lat: pos.coords.latitude,
						lon: pos.coords.longitude,
						accuracy: pos.coords.accuracy,
					},
					messages
				),
			(error) =>
				this.fail(
					error.code === error.PERMISSION_DENIED
						? "denied"
						: "unavailable",
					messages
				),
			{ enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }
		);
	}

	private async onPosition(
		position: UserPosition,
		messages: () => Messages
	): Promise<void> {
		this.position = position;
		const { lat, lon } = position;
		const inFlorence =
			lon >= FLORENCE_BBOX.west &&
			lon <= FLORENCE_BBOX.east &&
			lat >= FLORENCE_BBOX.south &&
			lat <= FLORENCE_BBOX.north;
		try {
			this.nearby = await api.nearby(lat, lon);
			const first = this.nearby.items[0];
			if (!first)
				return this.fail(
					inFlorence ? "noneNearby" : "outside",
					messages
				);
			this.locateStatus = "done";
			this.announce(
				messages().locate.found(this.nearby.items.length, first.name)
			);
			await this.selectStreet(first.slug, first.segment, undefined, true);
		} catch {
			this.fail("failed", messages);
		}
	}

	private fail(code: LocateError, messages: () => Messages): void {
		this.locateStatus = "error";
		this.locateError = code;
		this.announce(messages().locate[code]);
	}

	dismissLocateError(): void {
		this.locateError = null;
		this.locateStatus = "idle";
	}

	announce(message: string): void {
		// Reset first so repeated identical messages are announced again.
		this.announcement = "";
		queueMicrotask(() => (this.announcement = message));
	}

	private syncUrl(): void {
		const url = new URL(window.location.href);
		url.searchParams.delete("strada");
		url.searchParams.delete("tratto");
		if (this.selected) url.searchParams.set("strada", this.selected.slug);
		if (this.selected && this.selectedSegment)
			url.searchParams.set("tratto", this.selectedSegment);
		try {
			replaceState(url, page.state);
		} catch {
			history.replaceState(history.state, "", url);
		}
	}
}

const KEY = Symbol("app-state");

export function provideAppState(): AppState {
	return setContext(KEY, new AppState());
}

export function useAppState(): AppState {
	return getContext<AppState>(KEY);
}
