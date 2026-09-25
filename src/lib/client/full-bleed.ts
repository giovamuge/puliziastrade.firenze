/**
 * Full-bleed stage for Safari 26 (Liquid Glass): the browser composites real
 * page pixels under its translucent status bar and toolbar only for in-flow
 * content (fixed elements are just sampled for a tint), and under the status
 * bar only when the page is scrolled. So on phones the stage extends `--bleed`
 * above and below the visible viewport and the page rests scrolled by that
 * amount; the document itself never scrolls (`overflow: hidden` on the root).
 *
 * `bleed()` gives the current amount in CSS px, for map padding.
 */
let amount = 0;

export function bleed(): number {
	return amount;
}

export function fullBleed(stage: HTMLElement): () => void {
	const settle = () => {
		amount = Number.parseFloat(getComputedStyle(stage).getPropertyValue('--bleed')) || 0;
		if (window.scrollY !== amount) window.scrollTo({ top: amount, behavior: 'instant' });
	};
	// The on-screen keyboard may scroll the document to reveal the search field.
	const onFocusOut = () => requestAnimationFrame(settle);
	settle();
	window.addEventListener('resize', settle, { passive: true });
	window.addEventListener('pageshow', settle);
	document.addEventListener('focusout', onFocusOut);
	return () => {
		amount = 0;
		window.removeEventListener('resize', settle);
		window.removeEventListener('pageshow', settle);
		document.removeEventListener('focusout', onFocusOut);
	};
}
