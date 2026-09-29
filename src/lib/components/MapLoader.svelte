<script lang="ts">
	import { fade } from "svelte/transition";

	/**
	 * Map loading indicator: the street sweeper of the logo (without the lily) at
	 * work. It stays put while the road runs under it: dust on the grey road ahead
	 * slides into the spinning broom and disappears, the road behind is clean gold.
	 * Wheels turn and the body idles. Pure SVG + CSS animating only transform and
	 * opacity (compositor friendly); with reduced motion it rests as an illustration.
	 */
	let { label }: { label: string } = $props();

	/** Dust specks entering from the right, as [delay in s, y offset, radius]. */
	const DUST = [
		[0, 0, 0.7],
		[-0.35, -0.5, 0.5],
		[-0.7, 0.1, 0.8],
		[-1.05, -0.4, 0.55],
		[-1.4, 0, 0.65],
	] as const;
</script>

<div
	class="pointer-events-none absolute inset-0 grid place-items-center"
	role="status"
	out:fade={{ duration: 250 }}
>
	<!-- No card: just the sweeper on the map background, with the label under it. -->
	<div
		class="flex flex-col items-center gap-2 text-sm font-medium text-muted"
	>
		<svg
			class="loader"
			width="124"
			height="60"
			viewBox="2 8 60 29"
			aria-hidden="true"
		>
			<!-- Road: clean (gold) behind the broom, dirty (grey) ahead of it. -->
			<path
				class="road-clean"
				d="M5.6 30.2H30.5L32 27.4L34.4 31.8H5.6A.8 .8 0 0 1 5.6 30.2Z"
			/>
			<path class="road-dirty" d="M34 31h26" />
			{#each DUST as [delay, dy, r], i (i)}
				<circle
					class="dust"
					cx="60"
					cy={29.6 + dy}
					{r}
					style:animation-delay="{delay}s"
					style:--rest="{-5 - i * 5}px"
				/>
			{/each}

			<!-- Broom: fan of bristles swinging around its mount under the cab. -->
			<g class="broom">
				<path class="bristles" d="M32 27.4L34.4 31.6H29.6Z" />
				<path
					class="bristle-lines"
					d="M32 28.6L30.8 31.4M32 28.6V31.4M32 28.6L33.2 31.4"
				/>
			</g>

			<!-- Vehicle: body idles, wheels spin. -->
			<g class="body">
				<path
					class="paint"
					d="M5.5 26V16.8c0-3.2 2.6-5.8 5.8-5.8h10.4c.9 0 1.6.7 1.6 1.6V26z"
				/>
				<path
					class="paint"
					d="M23.9 12.4h4.9c1 0 1.9.6 2.2 1.6l2.5 7.2c.1.3.2.7.2 1V26h-9.8z"
				/>
				<rect
					class="paint"
					x="4.6"
					y="24.4"
					width="30"
					height="2.8"
					rx="1.4"
				/>
				<path
					class="glass-pane"
					d="M25.8 14.4h2.7c.4 0 .8.3.9.7l1.9 5.4h-5.5z"
				/>
			</g>
			{#each [11, 23.4] as cx (cx)}
				<g class="wheel" style:transform-origin="{cx}px 27.3px">
					<circle class="tyre" {cx} cy="27.3" r="2.9" />
					<path
						class="spokes"
						d="M{cx - 1.7} 27.3h3.4M{cx} 25.6v3.4"
					/>
				</g>
			{/each}
		</svg>
		<span>{label}</span>
	</div>
</div>

<style>
	.loader {
		--gold: #e8b84b;
		overflow: visible;
	}
	.road-clean {
		fill: var(--gold);
		stroke: var(--gold);
		stroke-width: 0.3;
		stroke-linejoin: round;
	}
	.road-dirty {
		stroke: var(--c-border);
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	.dust {
		fill: var(--c-muted);
		opacity: 0;
		animation: dust 1.75s linear infinite;
	}
	.bristles {
		fill: var(--gold);
		stroke: var(--gold);
		stroke-width: 0.8;
		stroke-linejoin: round;
	}
	.bristle-lines {
		stroke: var(--c-primary);
		stroke-width: 0.4;
		stroke-linecap: round;
	}
	.broom {
		transform-origin: 32px 27.6px;
		animation: brush 0.24s ease-in-out infinite alternate;
	}
	.paint {
		fill: var(--c-primary);
	}
	.glass-pane {
		fill: var(--c-surface);
	}
	.body {
		animation: idle 0.3s ease-in-out infinite alternate;
	}
	.tyre {
		fill: var(--c-text);
		stroke: var(--c-surface);
		stroke-width: 1.2;
	}
	.spokes {
		stroke: var(--c-surface);
		stroke-width: 0.7;
		stroke-linecap: round;
	}
	/* Moving right: the wheels turn clockwise. */
	.wheel {
		animation: spin 0.7s linear infinite;
	}

	/* The road runs left under the vehicle: dust travels from the edge into the broom (26 units). */
	@keyframes dust {
		0% {
			transform: translateX(0);
			opacity: 0;
		}
		12% {
			opacity: 0.7;
		}
		88% {
			opacity: 0.7;
		}
		100% {
			transform: translateX(-26px);
			opacity: 0;
		}
	}
	@keyframes brush {
		from {
			transform: rotate(-9deg);
		}
		to {
			transform: rotate(9deg);
		}
	}
	@keyframes idle {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-0.3px);
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dust,
		.broom,
		.body,
		.wheel {
			animation: none;
		}
		/* Resting positions spread along the dirty road. */
		.dust {
			opacity: 0.7;
			transform: translateX(var(--rest));
		}
	}
</style>
