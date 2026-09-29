import { readRomeInstant, type RomeInstant } from "$lib/domain/rome-clock";

const TICK_MS = 30_000;

/**
 * Reactive Europe/Rome clock. The same reactive object is refreshed in place
 * every 30 s, so ticking never allocates new state objects; dependents
 * (status badges, map colours) update automatically.
 */
export class RomeClock {
	readonly now: RomeInstant = $state({ day: 0, minute: 0 });
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor() {
		this.refresh();
	}

	refresh = (): void => {
		const next = readRomeInstant(Date.now());
		if (next.day !== this.now.day) this.now.day = next.day;
		if (next.minute !== this.now.minute) this.now.minute = next.minute;
	};

	start(): () => void {
		this.timer ??= setInterval(this.refresh, TICK_MS);
		const onVisible = () =>
			document.visibilityState === "visible" && this.refresh();
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			clearInterval(this.timer);
			this.timer = undefined;
			document.removeEventListener("visibilitychange", onVisible);
		};
	}
}
