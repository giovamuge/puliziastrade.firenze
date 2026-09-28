import type { HTMLAttributes } from 'svelte/elements';
import type { BottomSheet, BottomSheetDialogManager, SnapPositionChangeEventDetail } from 'pure-web-bottom-sheet';

/** Typings for the pure-web-bottom-sheet custom elements used in Svelte markup. */
declare module 'svelte/elements' {
	interface SvelteHTMLElements {
		'bottom-sheet': HTMLAttributes<HTMLElement> & {
			'swipe-to-dismiss'?: boolean;
			'nested-scroll'?: boolean;
			/** With nested-scroll: the content scrolls only once the sheet is fully expanded. */
			'expand-to-scroll'?: boolean;
			'expand-to-scroll'?: boolean;
			'content-height'?: boolean;
			'onsnap-position-change'?: (event: CustomEvent<SnapPositionChangeEventDetail>) => void;
		};
		'bottom-sheet-dialog-manager': HTMLAttributes<HTMLElement>;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'bottom-sheet': BottomSheet;
		'bottom-sheet-dialog-manager': BottomSheetDialogManager;
	}
}

export {};
