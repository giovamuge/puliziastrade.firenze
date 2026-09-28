/**
 * iOS-style page sheet: the page behind open bottom sheets dims, and while a
 * sheet is raised past its resting detent the page also shrinks, rounds its
 * corners and moves below the status bar (see `.sheet-backdrop` in app.css).
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
let target: HTMLElement | null = null;
let frame = 0;
let appliedLift = 0;
let appliedDim = 0;

function render(): void {
	frame = 0;
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
		target.style.setProperty('--sheet-lift', lift === 0 ? '0' : lift.toFixed(3));
	}
	if (dim !== appliedDim) {
		appliedDim = dim;
		target.style.setProperty('--sheet-dim', dim.toFixed(3));
	}
	target.toggleAttribute('data-sheet', open > 0 || lift > 0);
	// Modal behaviour for the non-modal sheet dialogs: the page is out of reach while one is open.
	target.inert = open > 0;
}

function schedule(): void {
	frame ||= requestAnimationFrame(render);
}

export function sheetSource(): SheetSource {
	let slot = lifts.indexOf(FREE);
	if (slot < 0) slot = lifts.push(0) - 1;
	lifts[slot] = 0;
	opens[slot] = 0;
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
			if (!open) lifts[slot] = 0;
			schedule();
		},
		dispose() {
			lifts[slot] = FREE;
			opens[slot] = 0;
			schedule();
		}
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
