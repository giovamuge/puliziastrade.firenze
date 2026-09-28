/**
 * Docks an element (the bottom search bar) right above the on-screen keyboard.
 *
 * The home stage is taller than the screen and rests scrolled by `--bleed`
 * (see full-bleed.ts). When the keyboard opens, Safari scrolls the document to
 * reveal the focused field using its own margins and the full stage height,
 * while the bar stays anchored to the bottom of a `dvh` layer the keyboard
 * does not shrink: the field ends up floating well above the keyboard (or
 * under it). The visual viewport is the only reliable measure of the area
 * left above the keyboard, so while it is open the bar is translated by
 * `--kb-shift` until its bottom sits `GAP` px above the keyboard.
 */
const GAP = 8;
/** A visual viewport this much shorter than the window means a keyboard, not browser chrome. */
const KEYBOARD_MIN = 120;

export function keyboardDock(node: HTMLElement): () => void {
	const vv = window.visualViewport;
	if (!vv) return () => {};
	let shift = 0;
	let frame = 0;

	const apply = (value: number) => {
		if (value === shift) return;
		shift = value;
		node.style.setProperty('--kb-shift', `${value}px`);
		node.toggleAttribute('data-keyboard', value !== 0);
	};

	const update = () => {
		frame = 0;
		const open = node.contains(document.activeElement) && window.innerHeight - vv.height > KEYBOARD_MIN;
		// Room above the keyboard, for popups that open upwards (search results).
		if (open) node.style.setProperty('--kb-room', `${Math.round(vv.height)}px`);
		else node.style.removeProperty('--kb-room');
		if (!open) return apply(0);
		// Measure the marked row, not the container: its bottom padding is the safe area the keyboard covers.
		const anchor = node.querySelector('[data-dock-anchor]') ?? node;
		const bottom = anchor.getBoundingClientRect().bottom - shift;
		apply(Math.round(vv.offsetTop + vv.height - GAP - bottom));
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(update);
	};

	vv.addEventListener('resize', schedule);
	vv.addEventListener('scroll', schedule);
	node.addEventListener('focusin', schedule);
	node.addEventListener('focusout', schedule);
	return () => {
		cancelAnimationFrame(frame);
		vv.removeEventListener('resize', schedule);
		vv.removeEventListener('scroll', schedule);
		node.removeEventListener('focusin', schedule);
		node.removeEventListener('focusout', schedule);
		node.style.removeProperty('--kb-shift');
		node.style.removeProperty('--kb-room');
		node.removeAttribute('data-keyboard');
	};
}
