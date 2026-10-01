/**
 * Full-bleed stage for Safari 26 (Liquid Glass): the browser composites real
 * page pixels under its translucent status bar and toolbar only for in-flow
 * content (fixed elements are just sampled for a tint), and under the status
 * bar only when the page is scrolled. So on phones the stage extends `--bleed`
 * above and below the visible viewport and the page rests scrolled by that
 * amount; the document itself never scrolls (`overflow: hidden` on the root).
 *
 * The keyboard overlays the page (`interactive-widget=overlays-content` in app.html):
 * without it Safari 26 shrinks the layout viewport and scrolls the whole document up
 * by the keyboard height, map included.
 *
 * Nothing else may move the resting position: focus moves (a sheet opening, closing and
 * handing focus back) can scroll the root even with `overflow: hidden`, and the page would
 * stay shifted, the map with it. Any scroll is put back.
 *
 * `bleed()` gives the current amount in CSS px, for map padding.
 */
let amount = 0;

export function bleed(): number {
	return amount;
}

export function fullBleed(stage: HTMLElement): () => void {
	const settle = () => {
		amount =
			Number.parseFloat(
				getComputedStyle(stage).getPropertyValue("--bleed")
			) || 0;
		if (window.scrollY !== amount)
			window.scrollTo({ top: amount, behavior: "instant" });
	};
	let frame = 0;
	const onScroll = () => {
		if (window.scrollY !== amount)
			frame ||= requestAnimationFrame(() => {
				frame = 0;
				settle();
			});
	};
	settle();
	window.addEventListener("resize", settle, { passive: true });
	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("pageshow", settle);
	return () => {
		amount = 0;
		cancelAnimationFrame(frame);
		window.removeEventListener("resize", settle);
		window.removeEventListener("scroll", onScroll);
		window.removeEventListener("pageshow", settle);
	};
}
