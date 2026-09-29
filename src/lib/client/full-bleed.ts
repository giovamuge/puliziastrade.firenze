/**
 * Full-bleed stage for Safari 26 (Liquid Glass): the browser composites real
 * page pixels under its translucent status bar and toolbar only for in-flow
 * content (fixed elements are just sampled for a tint), and under the status
 * bar only when the page is scrolled. So on phones the stage extends `--bleed`
 * above and below the visible viewport and the page rests scrolled by that
 * amount; the document itself never scrolls (`overflow: hidden` on the root).
 *
 * While a text field has focus the track below is dropped (`data-typing`). Safari 26
 * shrinks the layout viewport to the space above the keyboard and scrolls the document
 * to its end: with the track, the end is 128 px below the controls layer, and the
 * search field would float that much above the keyboard.
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
	const isTextField = (el: EventTarget | null) =>
		el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
	const onFocusIn = (event: FocusEvent) => {
		if (isTextField(event.target)) stage.dataset.typing = "";
	};
	// The keyboard scrolled the document: restore the track and the resting position.
	const onFocusOut = (event: FocusEvent) => {
		if (isTextField(event.relatedTarget)) return;
		delete stage.dataset.typing;
		requestAnimationFrame(settle);
	};
	settle();
	window.addEventListener("resize", settle, { passive: true });
	window.addEventListener("pageshow", settle);
	document.addEventListener("focusin", onFocusIn);
	document.addEventListener("focusout", onFocusOut);
	return () => {
		amount = 0;
		delete stage.dataset.typing;
		window.removeEventListener("resize", settle);
		window.removeEventListener("pageshow", settle);
		document.removeEventListener("focusin", onFocusIn);
		document.removeEventListener("focusout", onFocusOut);
	};
}
