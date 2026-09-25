<script lang="ts">
	import { fade } from 'svelte/transition';

	/**
	 * Map loading indicator: a broom sweeps a strip of road, leaving it clean.
	 * Pure SVG + CSS, animating only transform and opacity (compositor friendly);
	 * with reduced motion it rests as a static illustration.
	 */
	let { label }: { label: string } = $props();

	/** Dust specks on the road, as [x, y, r]. */
	const DUST = [
		[18, 22, 1.4],
		[27, 27, 1],
		[36, 20, 1.2],
		[47, 26, 1.5],
		[56, 21, 1],
		[66, 27, 1.3],
		[75, 22, 1.1],
		[86, 26, 1.4],
		[95, 21, 1],
		[104, 26, 1.2]
	] as const;
</script>

<div class="pointer-events-none absolute inset-0 grid place-items-center" role="status" out:fade={{ duration: 250 }}>
	<div class="glass text-muted flex flex-col items-center gap-2 px-5 py-4 text-sm">
		<svg class="loader" width="124" height="40" viewBox="0 0 124 40" aria-hidden="true">
			<rect class="road" x="6" y="16" width="112" height="16" rx="8" />
			{#each DUST as [x, y, r], i (i)}
				<circle class="dust" cx={x} cy={y} {r} />
			{/each}
			<rect class="clean" x="6" y="16" width="112" height="16" rx="8" />
			<g class="broom">
				<path d="M14 4l6 6M12 10l-7 7l2 3l3 0l7-7M9 13l2 2" transform="translate(-4 6) scale(1.25)" />
			</g>
		</svg>
		<span>{label}</span>
	</div>
</div>

<style>
	.loader {
		--sweep: 1.8s;
		overflow: visible;
	}
	.road {
		fill: var(--c-surface-2);
		stroke: var(--c-border);
	}
	.dust {
		fill: var(--c-muted);
		opacity: 0.55;
	}
	/* The clean stretch grows behind the broom, covering the dust. */
	.clean {
		fill: var(--c-surface);
		stroke: var(--c-border);
		transform-box: fill-box;
		transform-origin: left center;
		animation: clean var(--sweep) cubic-bezier(0.45, 0, 0.3, 1) infinite;
	}
	.broom {
		fill: none;
		stroke: var(--c-primary-text);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		/* Pivot near the bristles, for the sweeping strokes. */
		transform-box: fill-box;
		transform-origin: 25% 85%;
		animation: sweep var(--sweep) cubic-bezier(0.45, 0, 0.3, 1) infinite;
	}
	@keyframes clean {
		0% {
			transform: scaleX(0);
			opacity: 1;
		}
		75% {
			transform: scaleX(1);
			opacity: 1;
		}
		100% {
			transform: scaleX(1);
			opacity: 0;
		}
	}
	@keyframes sweep {
		0% {
			transform: translateX(0) rotate(0);
		}
		/* Small back-and-forth strokes while moving forward. */
		25% {
			transform: translateX(30px) rotate(-8deg);
		}
		50% {
			transform: translateX(56px) rotate(6deg);
		}
		75% {
			transform: translateX(96px) rotate(-6deg);
			opacity: 1;
		}
		100% {
			transform: translateX(96px) rotate(0);
			opacity: 0;
		}
	}
</style>
