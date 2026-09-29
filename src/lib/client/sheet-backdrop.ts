/**
 * iOS-style page sheet: the page behind open bottom sheets dims, and while a
 * sheet is raised past its resting detent the page also shrinks around the
 * centre of the screen and rounds its corners (see `.sheet-backdrop` in app.css).
 *
 * The dimming lives on the page, not on a dialog `::backdrop`: Safari 26 tints
 * its bars by sampling fixed backgrounds (and with a modal dialog open it stops
 * compositing the page under the status bar), while in-flow page pixels show
 * under them, so the dimmed map stays visible there. Sheets open non-modally;
 * the page is made inert instead.
 *
 * Sheets report through a `SheetSource` whether they are open and how far
 * they are raised (0–1); the page registers itself with `sheetBackdrop` and
 * renders the result through two non-inherited custom properties, at most once
 * per frame; `data-sheet` switches the effect on only while it is visible.
 * Stacked sheets, as on iOS: when a sheet is full screen and another opens over it,
 * the one below recedes like the page (`data-stacked` on its `<bottom-sheet>`, see
 * app.css): it shrinks around its top edge and dims, staying where it is. The newer
 * sheet never rises above it (its max height leaves the edge below in view), so
 * no position needs measuring. Over a sheet that is not full screen nothing changes.
 *
 * No allocations on the scroll path: state lives in slot arrays reused across sheets.
 */
export interface SheetSource {
	/** Raise level, 0 (resting detent or lower) to 1 (top). */
	lift(level: number): void;
	open(open: boolean): void;
	dispose(): void;
}

const FREE = -1;
/** Dimming added by each open sheet (stacked sheets dim further: 1 − (1 − d)ⁿ). */
const DIM_STEP = 0.25;

const lifts: number[] = [];
const opens: number[] = [];
/** The `<bottom-sheet>` of each slot, and when it was opened (0 = closed): stack order. */
const hosts: (HTMLElement | null)[] = [];
const openedAt: number[] = [];
let openCounter = 0;
/** Raise level from which a sheet counts as full screen. */
const FULL = 0.98;
let target: HTMLElement | null = null;
let frame = 0;
let appliedLift = 0;
let appliedDim = 0;

/** A sheet is stacked while it is full screen and a sheet opened after it is open. */
function restack(): void {
	for (let i = 0; i < hosts.length; i++) {
		const host = hosts[i];
		if (!host) continue;
		let covered = false;
		if (openedAt[i]! > 0 && lifts[i]! >= FULL) {
			for (let j = 0; j < hosts.length; j++)
				if (hosts[j] && openedAt[j]! > openedAt[i]!) covered = true;
		}
		if (covered !== host.hasAttribute("data-stacked"))
			host.toggleAttribute("data-stacked", covered);
	}
}

function render(): void {
	frame = 0;
	restack();
	if (!target) return;
	let lift = 0;
	let open = 0;
	for (let i = 0; i < lifts.length; i++) {
		if (lifts[i]! > lift) lift = lifts[i]!;
		if (opens[i] === 1) open++;
	}
	const dim = 1 - (1 - DIM_STEP) ** open;
	if (lift !== appliedLift) {
		appliedLift = lift;
		target.style.setProperty(
			"--sheet-lift",
			lift === 0 ? "0" : lift.toFixed(3)
		);
	}
	if (dim !== appliedDim) {
		appliedDim = dim;
		target.style.setProperty("--sheet-dim", dim.toFixed(3));
	}
	target.toggleAttribute("data-sheet", open > 0 || lift > 0);
	// Modal behaviour for the non-modal sheet dialogs: the page is out of reach while one is open.
	target.inert = open > 0;
}

function schedule(): void {
	frame ||= requestAnimationFrame(render);
}

export function sheetSource(host: HTMLElement | null = null): SheetSource {
	let slot = lifts.indexOf(FREE);
	if (slot < 0) slot = lifts.push(0) - 1;
	lifts[slot] = 0;
	opens[slot] = 0;
	hosts[slot] = host;
	openedAt[slot] = 0;
	return {
		lift(level) {
			if (lifts[slot] === level) return;
			lifts[slot] = level;
			schedule();
		},
		open(open) {
			const value = open ? 1 : 0;
			if (opens[slot] === value) return;
			opens[slot] = value;
			openedAt[slot] = open ? ++openCounter : 0;
			if (!open) lifts[slot] = 0;
			schedule();
		},
		dispose() {
			hosts[slot]?.removeAttribute("data-stacked");
			lifts[slot] = FREE;
			opens[slot] = 0;
			hosts[slot] = null;
			openedAt[slot] = 0;
			schedule();
		},
	};
}

/** Attachment for the page element that recedes behind the sheets. */
export function sheetBackdrop(node: HTMLElement): () => void {
	target = node;
	appliedLift = appliedDim = 0;
	schedule();
	return () => {
		if (target === node) target = null;
	};
}
