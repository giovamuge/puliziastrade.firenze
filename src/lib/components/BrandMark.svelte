<script lang="ts">
	let { size = 36 }: { size?: number } = $props();
</script>

<!--
	Original stylised Florentine lily (with the stamens between the petals that
	distinguish Florence's giglio) above a swept-street arc. Deliberately not the
	City's official coat of arms: this is an unofficial service.
-->
<svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
	<rect width="40" height="40" rx="11" fill="var(--c-primary)" />
	<g fill="#fff"><path d="M20 5c3.2 3.5 3.6 8 0 13.5c-3.6-5.5-3.2-10 0-13.5z"/><path d="M21.2 18.6c1.3-5.1 5.3-7.6 8.3-6.4c2 .8 1.7 3.8-.5 4.4c-.2-1.6-1.4-2-2.4-1.4c-1.8 1-3.2 2.4-3.8 3.8z"/><path d="M18.8 18.6c-1.3-5.1-5.3-7.6-8.3-6.4c-2 .8-1.7 3.8.5 4.4c.2-1.6 1.4-2 2.4-1.4c1.8 1 3.2 2.4 3.8 3.8z"/><path d="M21.8 15.2l3-5.4M18.2 15.2l-3-5.4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><circle cx="25.2" cy="9.1" r="1.3"/><circle cx="14.8" cy="9.1" r="1.3"/><rect x="14.4" y="18.6" width="11.2" height="2.6" rx="1.3"/><path d="M20 21.2c1.6 1.8 1.4 3.8 0 5.3c-1.4-1.5-1.6-3.5 0-5.3z"/><path d="M21 21.4c2.5.4 4.5 2 4 4.4c-.6-1.2-2-1.8-3.4-1.6z"/><path d="M19 21.4c-2.5.4-4.5 2-4 4.4c.6-1.2 2-1.8 3.4-1.6z"/></g>
	<path d="M7.5 32.5c7-3.2 18-3.2 25 0" fill="none" stroke="#f3c969" stroke-width="2.4" stroke-linecap="round" />
</svg>
