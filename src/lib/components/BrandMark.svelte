<script lang="ts">
	let { size = 36 }: { size?: number } = $props();
</script>

<!--
	Original mark: a street sweeper (glazed cab, rounded hopper, fan broom on the
	road it leaves clean, in gold) wearing a stylised Florentine lily on its side,
	red on white like the city's colours. Deliberately not the City's coat of arms:
	this is an unofficial service. Keep in sync with static/favicon.svg.
-->
<svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
	<rect width="40" height="40" rx="11" fill="var(--c-primary)"/><path d="M5 33.2h23.5" fill="none" stroke="#f3c969" stroke-width="1.6" stroke-linecap="round"/><g fill="#fff"><path d="M5.5 26V16.8c0-3.2 2.6-5.8 5.8-5.8h10.4c.9 0 1.6.7 1.6 1.6V26z"/><path d="M23.9 12.4h4.9c1 0 1.9.6 2.2 1.6l2.5 7.2c.1.3.2.7.2 1V26h-9.8z"/><rect x="4.6" y="24.4" width="30" height="2.8" rx="1.4"/></g><path d="M25.8 14.4h2.7c.4 0 .8.3.9.7l1.9 5.4h-5.5z" fill="var(--c-primary)"/><g fill="#fff" stroke="var(--c-primary)" stroke-width="1.2"><circle cx="11" cy="28.3" r="3"/><circle cx="23.4" cy="28.3" r="3"/></g><g fill="var(--c-primary)"><circle cx="11" cy="28.3" r=".9"/><circle cx="23.4" cy="28.3" r=".9"/></g><path d="M30.2 27.1l1.5 2.6" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><path d="M31.8 29.3l2.9 3.9h-5.8z" fill="#f3c969" stroke="#f3c969" stroke-width=".8" stroke-linejoin="round"/><path d="M30.4 33.2l1.4-3M31.8 33.2v-3M33.2 33.2l-1.4-3" stroke="var(--c-primary)" stroke-width=".42" stroke-linecap="round"/><g transform="translate(14.6 18.4) scale(.52) translate(-20 -15.75)" fill="var(--c-primary)"><path d="M20 5c3.2 3.5 3.6 8 0 13.5c-3.6-5.5-3.2-10 0-13.5z"/><path d="M21.2 18.6c1.3-5.1 5.3-7.6 8.3-6.4c2 .8 1.7 3.8-.5 4.4c-.2-1.6-1.4-2-2.4-1.4c-1.8 1-3.2 2.4-3.8 3.8z"/><path d="M18.8 18.6c-1.3-5.1-5.3-7.6-8.3-6.4c-2 .8-1.7 3.8.5 4.4c.2-1.6 1.4-2 2.4-1.4c1.8 1 3.2 2.4 3.8 3.8z"/><path d="M21.8 15.2l3-5.4M18.2 15.2l-3-5.4" fill="none" stroke="var(--c-primary)" stroke-width="1.3" stroke-linecap="round"/><circle cx="25.2" cy="9.1" r="1.3"/><circle cx="14.8" cy="9.1" r="1.3"/><rect x="14.4" y="18.6" width="11.2" height="2.6" rx="1.3"/><path d="M20 21.2c1.6 1.8 1.4 3.8 0 5.3c-1.4-1.5-1.6-3.5 0-5.3z"/><path d="M21 21.4c2.5.4 4.5 2 4 4.4c-.6-1.2-2-1.8-3.4-1.6z"/><path d="M19 21.4c-2.5.4-4.5 2-4 4.4c.6-1.2 2-1.8 3.4-1.6z"/></g>
</svg>
