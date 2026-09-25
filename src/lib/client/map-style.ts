import type { ExpressionSpecification } from 'maplibre-gl';
import type { Messages } from '$lib/i18n';
import type { MapMode } from './app-state.svelte';
import type { Theme } from './preferences.svelte';

/**
 * Map colour system. Every legend entry is distinguished by colour AND line
 * width, so the map stays readable with colour-vision deficiencies.
 */
export interface LegendEntry {
	value: number;
	color: string;
	width: number;
}

export const BASEMAP = {
	light: 'https://tiles.openfreemap.org/styles/positron',
	dark: 'https://tiles.openfreemap.org/styles/dark'
} as const;

export const ACCENT = { light: '#5b2a86', dark: '#c3a0ec' } as const;
/**
 * Categorical colours for the schedule groups of the selected street, so
 * stretches with different days/times are told apart at a glance. Paired
 * with on-map labels, never colour alone.
 */
export const GROUP_COLORS = {
	light: ['#5b2a86', '#0f7c8c', '#b4531a', '#2d6a4f', '#8a1c7c', '#34568b'],
	dark: ['#c3a0ec', '#4fc3d9', '#ff9a5c', '#7fd19b', '#f28fe0', '#8fb4ff']
} as const;

export function groupColor(theme: Theme, index: number): string {
	const palette = GROUP_COLORS[theme];
	return palette[index % palette.length]!;
}

/** Opaque halo under the selected street (opaque so overlapping joins don't darken). */
export const CASING = { light: '#d8c6ea', dark: '#5a4675' } as const;

const NONE = 255;


const LEGENDS: Record<MapMode, Record<Theme, LegendEntry[]>> = {
	urgency: {
		light: [
			{ value: 0, color: '#a6192e', width: 6 },
			{ value: 1, color: '#d9541e', width: 5 },
			{ value: 2, color: '#5b8a86', width: 3.5 },
			{ value: 3, color: '#e3a21a', width: 4 },
			{ value: 4, color: '#5f7885', width: 2.5 },
			{ value: 5, color: '#b3bec4', width: 1.5 }
		],
		dark: [
			{ value: 0, color: '#ff5a6e', width: 6 },
			{ value: 1, color: '#ff8a4c', width: 5 },
			{ value: 2, color: '#7fa9a4', width: 3.5 },
			{ value: 3, color: '#f5c04a', width: 4 },
			{ value: 4, color: '#8fa9b6', width: 2.5 },
			{ value: 5, color: '#66737b', width: 1.5 }
		]
	},
	day: {
		light: [
			{ value: 0, color: '#5b2a86', width: 5 },
			{ value: 1, color: '#e3a21a', width: 5 },
			{ value: 2, color: '#1f7a8c', width: 5 },
			{ value: NONE, color: '#c9d0d4', width: 1 }
		],
		dark: [
			{ value: 0, color: '#b08ae0', width: 5 },
			{ value: 1, color: '#f5c04a', width: 5 },
			{ value: 2, color: '#4fc3d9', width: 5 },
			{ value: NONE, color: '#3a444a', width: 1 }
		]
	},
	reviews: {
		light: [
			{ value: 0, color: '#2e7d4f', width: 5 },
			{ value: 1, color: '#e3a21a', width: 4 },
			{ value: 2, color: '#a6192e', width: 5 },
			{ value: 3, color: '#3b0a45', width: 6 },
			{ value: NONE, color: '#c9d0d4', width: 1 }
		],
		dark: [
			{ value: 0, color: '#6fd39a', width: 5 },
			{ value: 1, color: '#f5c04a', width: 4 },
			{ value: 2, color: '#ff5a6e', width: 5 },
			{ value: 3, color: '#e2a6ff', width: 6 },
			{ value: NONE, color: '#3a444a', width: 1 }
		]
	}
};

export function legendFor(mode: MapMode, theme: Theme): LegendEntry[] {
	return LEGENDS[mode][theme];
}

/** Localised labels, aligned by position with `legendFor(mode, …)`. */
export function legendLabels(mode: MapMode, m: Messages): readonly string[] {
	return mode === 'urgency' ? m.map.urgency : mode === 'day' ? m.map.bands : m.map.reviewStates;
}

function matchState(entries: LegendEntry[], pick: (e: LegendEntry) => string | number, fallback: string | number): ExpressionSpecification {
	const branches = entries.flatMap((e) => [e.value, pick(e)]);
	return ['match', ['coalesce', ['feature-state', 'v'], NONE], ...branches, fallback] as unknown as ExpressionSpecification;
}

export function lineColor(mode: MapMode, theme: Theme): ExpressionSpecification {
	const entries = legendFor(mode, theme);
	return matchState(entries, (e) => e.color, entries.at(-1)!.color);
}

/** Width scales with zoom; per-feature base width comes from the legend. */
export function lineWidth(mode: MapMode, theme: Theme): ExpressionSpecification {
	const base = matchState(legendFor(mode, theme), (e) => e.width, 1);
	return ['interpolate', ['exponential', 1.6], ['zoom'], 11, ['*', 0.35, base], 14, ['*', 0.8, base], 17, ['*', 2.2, base]] as ExpressionSpecification;
}
