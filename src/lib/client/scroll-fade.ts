/**
 * Scroll fade: softly fades content at the edges of a scroll container, only
 * on the sides where more content is hidden. Writes `--fade-top` and
 * `--fade-bottom` on `target` (inherited by the masked element, also across
 * shadow DOM `::part`s). One passive listener, updates batched per frame.
 */
const FADE_PX = 28;

export function scrollFade(
	scroller: HTMLElement,
	target: HTMLElement = scroller
): () => void {
	let frame = 0;
	const update = () => {
		frame = 0;
		const { scrollTop, scrollHeight, clientHeight } = scroller;
		const top = Math.min(FADE_PX, Math.max(0, scrollTop));
		const bottom = Math.min(
			FADE_PX,
			Math.max(0, scrollHeight - clientHeight - scrollTop)
		);
		target.style.setProperty("--fade-top", `${top}px`);
		target.style.setProperty("--fade-bottom", `${bottom}px`);
	};
	const schedule = () => {
		frame ||= requestAnimationFrame(update);
	};
	scroller.addEventListener("scroll", schedule, { passive: true });
	const resize = new ResizeObserver(schedule);
	resize.observe(scroller);
	// Content changes (views switching) alter scrollHeight without resizing the scroller.
	const mutations = new MutationObserver(schedule);
	mutations.observe(target, { childList: true, subtree: true });
	update();
	return () => {
		cancelAnimationFrame(frame);
		scroller.removeEventListener("scroll", schedule);
		resize.disconnect();
		mutations.disconnect();
	};
}
