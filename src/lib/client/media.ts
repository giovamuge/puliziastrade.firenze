import { MediaQuery } from 'svelte/reactivity';

/**
 * Layout breakpoint: from tablets up, street details live in a sidebar next
 * to the map; on phones they use a bottom sheet. Keep in sync with the `md:`
 * Tailwind breakpoint used by the layout.
 */
export const WIDE_QUERY = '(min-width: 768px)';

/** Reactive, SSR-safe (false on the server). */
export const wideScreen = new MediaQuery('min-width: 768px', false);
