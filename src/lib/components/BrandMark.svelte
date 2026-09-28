<script lang="ts">
	let { size = 36 }: { size?: number } = $props();
</script>

<!--
	Street sweeper (glazed cab, rounded hopper, fan broom rising from the gold road it
	leaves clean) wearing the Florentine gothic lily on its side, red on white.
	The lily is simplified from "Firenze giglio gotico antico" by Horemhat (Wikimedia
	Commons, CC BY-SA 4.0), so the logo is CC BY-SA 4.0 (see README); no shield, not the
	City's coat of arms. Keep in sync with static/favicon.svg.
-->
<svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
	<rect width="40" height="40" rx="11" fill="var(--c-primary)"/><g transform="translate(0 -1.3)"><path d="M5.6 30.2H29.4L31.6 27.4L34.6 31.8H5.6A.8 .8 0 0 1 5.6 30.2Z" fill="#f3c969" stroke="#f3c969" stroke-width=".3" stroke-linejoin="round"/><path d="M30.6 31.8l1-3.4M31.9 31.8v-3.4M33.2 31.8l-1.1-3.4" stroke="var(--c-primary)" stroke-width=".42" stroke-linecap="round"/><g fill="#fff"><path d="M5.5 26V16.8c0-3.2 2.6-5.8 5.8-5.8h10.4c.9 0 1.6.7 1.6 1.6V26z"/><path d="M23.9 12.4h4.9c1 0 1.9.6 2.2 1.6l2.5 7.2c.1.3.2.7.2 1V26h-9.8z"/><rect x="4.6" y="24.4" width="30" height="2.8" rx="1.4"/></g><path d="M25.8 14.4h2.7c.4 0 .8.3.9.7l1.9 5.4h-5.5z" fill="var(--c-primary)"/><g fill="#fff" stroke="var(--c-primary)" stroke-width="1.2"><circle cx="11" cy="27.3" r="2.9"/><circle cx="23.4" cy="27.3" r="2.9"/></g><g fill="var(--c-primary)"><circle cx="11" cy="27.3" r=".9"/><circle cx="23.4" cy="27.3" r=".9"/></g><g transform="translate(14.5 17.9) scale(.135) translate(-50 -48.5)" fill="var(--c-primary)"><path d="M53 62C54 47 62 37 74 35.5C86 34 94 42 92.5 52C91 60 83 63 79.5 57.5C84.5 57.5 86.5 51 82.5 47.5C76 43 65.5 50 60 62Z"/><path d="M55.5 55L76 21" fill="none" stroke="var(--c-primary)" stroke-width="3.6" stroke-linecap="round"/><circle cx="78" cy="13.5" r="3.6"/><circle cx="83.5" cy="18.8" r="3.6"/><circle cx="77.6" cy="20.8" r="3.2"/><path d="M53 71.5C62 72 71 77 72.5 86C68 81 61 78.5 54 79Z"/><g transform="matrix(-1 0 0 1 100 0)"><path d="M53 62C54 47 62 37 74 35.5C86 34 94 42 92.5 52C91 60 83 63 79.5 57.5C84.5 57.5 86.5 51 82.5 47.5C76 43 65.5 50 60 62Z"/><path d="M55.5 55L76 21" fill="none" stroke="var(--c-primary)" stroke-width="3.6" stroke-linecap="round"/><circle cx="78" cy="13.5" r="3.6"/><circle cx="83.5" cy="18.8" r="3.6"/><circle cx="77.6" cy="20.8" r="3.2"/><path d="M53 71.5C62 72 71 77 72.5 86C68 81 61 78.5 54 79Z"/></g><path d="M50 3C58 13 64 23 62 37C60.5 48 55.5 56 53 62H47C44.5 56 39.5 48 38 37C36 23 42 13 50 3Z"/><rect x="33" y="60" width="34" height="9" rx="4.5"/><path d="M50 70C55 76 55.5 85 50 94C44.5 85 45 76 50 70Z"/></g></g>
</svg>
