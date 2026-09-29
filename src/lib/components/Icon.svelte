<script lang="ts" module>
	/** Minimal hand-drawn 24×24 stroke icons (no icon font, no extra dependency). */
	const PATHS = {
		locate: "M12 2v3M12 19v3M2 12h3M19 12h3M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z",
		search: "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM15.5 15.5L20 20",
		calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
		share: "M12 3v12M7 8l5-5l5 5M5 13v7h14v-7",
		check: "M5 12.5l4.5 4.5L19 7.5",
		close: "M6 6l12 12M18 6L6 18",
		info: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v6M12 7.5v.5",
		star: "M12 3.5l2.6 5.3l5.9.9l-4.25 4.1l1 5.8L12 16.9l-5.25 2.7l1-5.8L3.5 9.7l5.9-.9z",
		broom: "M14 4l6 6M12 10l-7 7l2 3l3 0l7-7M9 13l2 2",
		copy: "M9 9h11v11H9zM5 15H4V4h11v1",
		chevron: "M9 6l6 6l-6 6",
		car: "M5 16h14M6 16l1.5-5h9L18 16M7 16v2M17 16v2M8 13.5h.01M16 13.5h.01",
		map: "M3 6l6-3l6 3l6-3v15l-6 3l-6-3l-6 3zM9 3v15M15 6v15",
		bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
		back: "M15 6l-6 6l6 6",
		legend: "M4 6h3M4 12h3M4 18h3M11 6h9M11 12h9M11 18h9",
		settings: "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4",
		download: "M12 4v11M7 10l5 5l5-5M5 20h14",
		external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
		up: "M6 15l6-6l6 6",
		down: "M6 9l6 6l6-6",
		chat: "M5 5h14v10H10l-4 4v-4H5z",
		list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
	} as const;
	export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
	let {
		name,
		size = 20,
		class: className = "",
	}: { name: IconName; size?: number; class?: string } = $props();
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	<path d={PATHS[name]} />
</svg>
