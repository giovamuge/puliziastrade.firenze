<script lang="ts" module>
	function pointSegmentDistance(
		px: number,
		py: number,
		ax: number,
		ay: number,
		bx: number,
		by: number
	): number {
		const dx = bx - ax;
		const dy = by - ay;
		const len2 = dx * dx + dy * dy;
		const t =
			len2 > 0
				? Math.max(
						0,
						Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)
					)
				: 0;
		return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
	}
</script>

<script lang="ts">
	import { onMount, untrack } from "svelte";
	import type {
		ExpressionSpecification,
		GeoJSONSource,
		LngLat,
		Map as MapLibreMap,
		MapLayerMouseEvent,
		PaddingOptions,
		Popup,
	} from "maplibre-gl";
	import type {
		MapLayerDto,
		ReviewSummaryResponse,
	} from "$lib/api/contracts";
	import { api } from "$lib/client/api";
	import { useAppState } from "$lib/client/app-state.svelte";
	import { toFeatureCollection } from "$lib/client/map-layer";
	import {
		ACCENT,
		BASEMAP,
		EMPTY_IMAGE,
		GROUP_COLORS,
		lineColor,
		lineWidth,
		trimBasemap,
	} from "$lib/client/map-style";
	import { groupRules } from "$lib/domain/describe";
	import { RULE_STRIDE } from "$lib/domain/schedule";
	import type { Weekday } from "$lib/domain/civil-date";
	import { usePreferences, type Theme } from "$lib/client/preferences.svelte";
	import { NO_BAND, UrgencyCalculator } from "$lib/domain/urgency";
	import { foldText } from "$lib/domain/street-name";
	import { wideScreen } from "$lib/client/media";
	import { bleed } from "$lib/client/full-bleed";
	import MapLoader from "./MapLoader.svelte";

	const app = useAppState();
	const prefs = usePreferences();
	const FLORENCE: [number, number] = [11.2558, 43.7696];

	let container: HTMLDivElement;
	let map = $state.raw<MapLibreMap>();
	let popup: Popup | undefined;
	let layer: MapLayerDto | undefined;
	let features: GeoJSON.FeatureCollection | undefined;
	let calculator: UrgencyCalculator | undefined;
	let codeToArc = new Map<string, number>();
	/** Folded street name → slug, to link basemap roads to streets that do have data. */
	let slugByName = new Map<string, string>();
	let infoPopup: Popup | undefined;
	/** Last value pushed to feature-state per arc: only changed arcs are updated. */
	let applied: Uint8Array | undefined;
	let reviewValues: Uint8Array | undefined;
	let summary: ReviewSummaryResponse | undefined;
	/** Theme of the basemap currently loaded. */
	let styleTheme: Theme | undefined;

	let status = $state<"loading" | "ready" | "error">("loading");
	/** The first full load (basemap and street layers) completed: later style swaps keep the map on screen. */
	let loaded = $state(false);

	const reducedMotion = () =>
		matchMedia("(prefers-reduced-motion: reduce)").matches;

	onMount(() => {
		let disposed = false;
		(async () => {
			try {
				const [maplibregl, worker, data] = await Promise.all([
					import("maplibre-gl"),
					// Bundled by Vite so the worker and its shared chunk resolve in dev and in production.
					import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
					api.mapLayer(),
					import("maplibre-gl/dist/maplibre-gl.css"),
				]);
				if (disposed) return;
				maplibregl.setWorkerUrl(worker.default);
				layer = data;
				calculator = new UrgencyCalculator(
					data.rules,
					data.arcRuleOffsets,
					data.arcRules
				);
				codeToArc = new Map(data.arcCodes.map((c, i) => [c, i]));
				slugByName = new Map(
					data.streetNames.map((n, i) => [
						foldText(n),
						data.streetSlugs[i]!,
					])
				);
				applied = new Uint8Array(data.arcStreet.length);
				features = toFeatureCollection(data);

				styleTheme = prefs.theme;
				const m = new maplibregl.Map({
					container,
					center: FLORENCE,
					zoom: 13,
					minZoom: 10.5,
					maxBounds: [
						[10.9, 43.6],
						[11.6, 43.95],
					],
					dragRotate: false,
					pitchWithRotate: false,
					touchPitch: false,
					attributionControl: { compact: true },
					locale: {
						"NavigationControl.ZoomIn": prefs.m.map.zoomIn,
						"NavigationControl.ZoomOut": prefs.m.map.zoomOut,
					},
				});
				map = m;
				if (import.meta.env.DEV)
					(window as unknown as { __map: MapLibreMap }).__map = m;
				m.touchZoomRotate.disableRotation();
				m.addControl(
					new maplibregl.NavigationControl({ showCompass: false }),
					"bottom-right"
				);
				popup = new maplibregl.Popup({
					closeButton: false,
					closeOnClick: false,
					offset: 8,
				});
				infoPopup = new maplibregl.Popup({
					closeButton: true,
					closeOnClick: true,
					maxWidth: "18rem",
					className: "map-info",
				});

				m.setStyle(BASEMAP[styleTheme], {
					transformStyle: trimBasemap,
				});
				// Silences "image could not be loaded" for sprite entries the basemap lacks (they draw nothing anyway).
				m.on("styleimagemissing", (e) => {
					if (!m.hasImage(e.id)) m.addImage(e.id, EMPTY_IMAGE);
				});
				m.on("style.load", installLayers);
				m.on("error", (e) => console.warn("[map]", e.error?.message));
				m.on("click", "arcs-hit", onClick);
				m.on("click", onMapClick);
				m.on("mousemove", "arcs-hit", onHover);
				m.on("mouseleave", "arcs-hit", () => {
					m.getCanvas().style.cursor = "";
					popup?.remove();
				});
			} catch (error) {
				console.error(error);
				status = "error";
			}
		})();

		return () => {
			disposed = true;
			map?.remove();
		};
	});

	/** Our lines go above every basemap fill/line layer but below all labels that follow them. */
	function labelsAnchor(): string | undefined {
		const layers = map!.getStyle().layers;
		return layers[layers.findLastIndex((l) => l.type !== "symbol") + 1]?.id;
	}

	function installLayers(): void {
		const m = map!;
		const theme = styleTheme!;
		const before = labelsAnchor();
		applied!.fill(254); // feature-state is dropped with the style
		m.addSource("arcs", {
			type: "geojson",
			data: features!,
			tolerance: 0.25,
		});
		m.addSource("me", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
		m.addSource("sel", {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});

		m.addLayer(
			{
				id: "arcs-line",
				type: "line",
				source: "arcs",
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": lineColor(app.mapMode, theme),
					"line-width": lineWidth(app.mapMode, theme),
				},
			},
			before
		);
		// Selected street, one colour per schedule group; the focused group is drawn wider.
		const groupColor = [
			"to-color",
			[
				"at",
				["%", ["get", "g"], GROUP_COLORS[theme].length],
				["literal", [...GROUP_COLORS[theme]]],
			],
		] as unknown as ExpressionSpecification;
		m.addLayer(
			{
				id: "sel-halo",
				type: "line",
				source: "sel",
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": groupColor,
					"line-opacity": 0.28,
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						11,
						8,
						17,
						26,
					],
				},
			},
			before
		);
		m.addLayer(
			{
				id: "sel-line",
				type: "line",
				source: "sel",
				layout: { "line-cap": "round", "line-join": "round" },
				paint: {
					"line-color": groupColor,
					"line-width": [
						"interpolate",
						["linear"],
						["zoom"],
						11,
						["case", ["==", ["get", "focus"], 1], 5, 3],
						17,
						["case", ["==", ["get", "focus"], 1], 12, 7],
					],
				},
			},
			before
		);
		m.addLayer({
			id: "arcs-hit",
			type: "line",
			source: "arcs",
			paint: {
				"line-color": "#000",
				"line-opacity": 0,
				"line-width": 18,
			},
		});
		m.addLayer({
			id: "me-accuracy",
			type: "circle",
			source: "me",
			paint: {
				"circle-color": ACCENT[theme],
				"circle-opacity": 0.14,
				"circle-radius": [
					"interpolate",
					["exponential", 2],
					["zoom"],
					10,
					["/", ["get", "acc"], 150],
					20,
					["*", ["get", "acc"], 7],
				],
			},
		});
		m.addLayer({
			id: "me-dot",
			type: "circle",
			source: "me",
			paint: {
				"circle-color": ACCENT[theme],
				"circle-radius": 7,
				"circle-stroke-color": "#fff",
				"circle-stroke-width": 3,
			},
		});
		// Day and time written along each stretch of the selected street.
		m.addLayer({
			id: "sel-label",
			type: "symbol",
			source: "sel",
			minzoom: 13,
			layout: {
				"symbol-placement": "line",
				"symbol-spacing": 280,
				"text-field": ["get", "label"],
				"text-font": ["Noto Sans Regular"],
				"text-size": [
					"interpolate",
					["linear"],
					["zoom"],
					13,
					11,
					17,
					14,
				],
				"text-offset": [0, -1.1],
				"text-allow-overlap": false,
			},
			paint: {
				"text-color": groupColor,
				"text-halo-color": theme === "dark" ? "#121517" : "#ffffff",
				"text-halo-width": 2,
			},
		});

		status = "ready";
		loaded = true;
		refreshColors();
		refreshSelection(false);
		refreshPosition(false);
	}

	/** Recomputes per-arc values for the active mode and pushes only the diffs. */
	function refreshColors(): void {
		if (!map || status !== "ready" || !calculator || !applied) return;
		const { day, minute } = app.clock.now;
		let values: Uint8Array;
		if (app.mapMode === "urgency")
			values = calculator.computeUrgency(day, minute);
		else if (app.mapMode === "day")
			values = calculator.computeDayBands(day + app.dayOffset);
		else
			values =
				reviewValues ?? new Uint8Array(applied.length).fill(NO_BAND);

		const tally = [0, 0, 0, 0, 0, 0, 0, 0];
		for (let a = 0; a < values.length; a++) {
			const v = values[a]!;
			tally[v === NO_BAND ? 7 : Math.min(v, 6)]!++;
			if (applied[a] !== v) {
				applied[a] = v;
				map.setFeatureState({ source: "arcs", id: a }, { v });
			}
		}
		app.mapCounts = tally;
		map.setPaintProperty(
			"arcs-line",
			"line-color",
			lineColor(app.mapMode, styleTheme!)
		);
		map.setPaintProperty(
			"arcs-line",
			"line-width",
			lineWidth(app.mapMode, styleTheme!)
		);
	}

	/**
	 * Leaves room for the floating controls and the street panel: sidebar (wide) or bottom sheet (~62%).
	 * On phones the map also runs under the browser bars (full bleed): above the visible
	 * area by the status-bar allowance (`--under-status`, 64 px at most), below it by the
	 * whole track. Both are padded out so the framing matches what is on screen.
	 */
	/** Keep in sync with `--under-status` in app.css (4rem). */
	const UNDER_STATUS_PX = 64;

	/**
	 * Visible screen height (100dvh), read from the full-bleed stage. Unlike
	 * `innerHeight` it does not shrink while the on-screen keyboard is open, which
	 * would frame a street chosen from search for half a screen.
	 */
	function screenHeight(): number {
		const stage = container?.closest<HTMLElement>(".stage");
		return stage ? stage.clientHeight - 2 * bleed() : window.innerHeight;
	}

	function padding(): Required<PaddingOptions> {
		const wide = wideScreen.current;
		const edge = bleed();
		const base = {
			top: (wide ? 80 : 120) + Math.min(edge, UNDER_STATUS_PX),
			right: 50,
			bottom: 110 + edge,
			left: 50,
		};
		if (!app.sheetOpen) return base;
		return wide
			? { ...base, left: 470 }
			: { ...base, bottom: Math.round(screenHeight() * 0.64) + edge };
	}

	function refreshSelection(animate = true, fit = true): void {
		if (!map || status !== "ready" || !layer || !features) return;
		const selected = app.selected;
		const focus = app.selectedGroup;
		const selection: GeoJSON.Feature[] = [];
		selected?.groups.forEach((group, g) => {
			const label = group.rules
				.map((r) => prefs.f.ruleShort(r))
				.join(" · ");
			for (const code of group.segments) {
				const arc = codeToArc.get(code);
				const base =
					arc === undefined ? undefined : features!.features[arc];
				if (base)
					selection.push({
						type: "Feature",
						id: arc,
						geometry: base.geometry,
						properties: { g, label, focus: g === focus ? 1 : 0 },
					});
			}
		});
		(map.getSource("sel") as GeoJSONSource).setData({
			type: "FeatureCollection",
			features: selection,
		});

		// Tapped on the map or chosen from search alike: zoom to the stretch (or the street), clear of the panel.
		if (!fit || !selected) return;
		const group = focus >= 0 ? selected.groups[focus] : undefined;
		const bbox = group?.bbox ?? selected.bbox;
		// Found by "my position" without a stretch: stay centred on the user (refreshPosition).
		if (bbox && !(app.selectedByLocate && !group)) {
			const [w, s, e, n] = bbox;
			map.fitBounds(
				[
					[w, s],
					[e, n],
				],
				{
					padding: padding(),
					maxZoom: 17,
					duration: animate && !reducedMotion() ? 700 : 0,
				}
			);
		}
	}

	function refreshPosition(animate = true): void {
		if (!map || status !== "ready") return;
		const p = app.position;
		(map.getSource("me") as GeoJSONSource).setData({
			type: "FeatureCollection",
			features: p
				? [
						{
							type: "Feature",
							properties: { acc: Math.min(p.accuracy, 500) },
							geometry: {
								type: "Point",
								coordinates: [p.lon, p.lat],
							},
						},
					]
				: [],
		});
		if (!p) return;
		// An offset, not `padding`: easeTo keeps its padding on the map, and every later
		// fitBounds adds it to its own, leaving no room to frame a street chosen from search.
		const { top, right, bottom, left } = padding();
		map.easeTo({
			center: [p.lon, p.lat],
			zoom: 17,
			offset: [(left - right) / 2, (top - bottom) / 2],
			duration: animate && !reducedMotion() ? 800 : 0,
		});
	}

	function onClick(event: MapLayerMouseEvent): void {
		const feature = event.features?.[0];
		if (!feature || !layer || feature.id === undefined) return;
		const arc = Number(feature.id);
		void app.selectStreet(
			layer.streetSlugs[layer.arcStreet[arc]!]!,
			layer.arcCodes[arc]!,
			prefs.m.street.selectedAnnounce
		);
	}

	const ROAD_HIT_PX = 12;

	/**
	 * Tap on the map away from our segments but on a basemap road. If the road's
	 * name exists in the open data, open that street like any other (its mapped
	 * segments carry the schedule); otherwise just say there is no data for it.
	 */
	function onMapClick(event: MapLayerMouseEvent): void {
		if (
			!map ||
			!infoPopup ||
			map.queryRenderedFeatures(event.point, { layers: ["arcs-hit"] })
				.length
		)
			return;
		const road: RoadHit | null = basemapRoadAt(
			event.point.x,
			event.point.y
		);
		if (!road) return;

		const slug = road.name
			? slugByName.get(foldText(road.name))
			: undefined;
		const distance = slug
			? distanceToStreet(slug, event.lngLat.lng, event.lngLat.lat)
			: Infinity;
		if (slug && distance <= SAME_STREET_METERS) {
			void app
				.selectStreet(slug, null, prefs.m.street.selectedAnnounce)
				.then(() => (app.unmappedTap = true));
			return;
		}

		const box = document.createElement("div");
		box.className = "space-y-2 text-sm font-normal";
		const text = document.createElement("p");
		box.append(text);
		if (slug && road.name) {
			// Same name, different place (homonyms are common): say so and let people choose.
			text.textContent = prefs.m.map.sameNameElsewhere(
				road.name,
				prefs.f.distance(distance)
			);
			const button = document.createElement("button");
			button.type = "button";
			button.className = "btn-secondary min-h-9 w-full text-xs";
			button.textContent = prefs.m.map.openElsewhere;
			button.addEventListener("click", () => {
				infoPopup?.remove();
				void app.selectStreet(
					slug,
					null,
					prefs.m.street.selectedAnnounce
				);
			});
			box.append(button);
		} else {
			text.textContent = road.name
				? prefs.m.map.noData(road.name)
				: prefs.m.map.noDataUnnamed;
		}
		infoPopup.setLngLat(event.lngLat).setDOMContent(box).addTo(map);
	}

	/** A basemap road counts as the same street only if its mapped segments are this close. */
	const SAME_STREET_METERS = 600;

	/** Metres from a point to the nearest vertex of the street's mapped segments. */
	function distanceToStreet(slug: string, lon: number, lat: number): number {
		const street = layer!.streetSlugs.indexOf(slug);
		const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
		let best = Infinity;
		for (let a = 0; a < layer!.arcStreet.length; a++) {
			if (layer!.arcStreet[a] !== street) continue;
			for (const [x, y] of (
				features!.features[a]!.geometry as GeoJSON.LineString
			).coordinates) {
				best = Math.min(
					best,
					Math.hypot((x! - lon) * kx, (y! - lat) * 110_574)
				);
			}
		}
		return best;
	}

	/** Nearest basemap road (OpenMapTiles `transportation(_name)`) within a few pixels of the tap. */
	interface RoadHit {
		name: string | null;
	}

	function basemapRoadAt(x: number, y: number): RoadHit | null {
		const m = map!;
		let best = null as RoadHit | null;
		let bestDistance = ROAD_HIT_PX;
		for (const sourceLayer of ["transportation_name", "transportation"]) {
			for (const f of m.querySourceFeatures("openmaptiles", {
				sourceLayer,
			})) {
				const g = f.geometry;
				const lines =
					g.type === "LineString"
						? [g.coordinates]
						: g.type === "MultiLineString"
							? g.coordinates
							: [];
				for (const line of lines) {
					for (let i = 0; i < line.length - 1; i++) {
						const a = m.project(line[i] as [number, number]);
						const b = m.project(line[i + 1] as [number, number]);
						const d = pointSegmentDistance(
							x,
							y,
							a.x,
							a.y,
							b.x,
							b.y
						);
						if (d < bestDistance) {
							const props = f.properties ?? {};
							const name = (props["name:it"] ??
								props["name"] ??
								null) as string | null;
							// Prefer named features: a nameless line only wins if nothing named is as close.
							if (name || !best?.name) {
								bestDistance = d;
								best = { name };
							}
						}
					}
				}
			}
			if (best?.name) break;
		}
		return best;
	}

	/** Tooltip: street name and the day/time rules of the hovered stretch. */
	function onHover(event: MapLayerMouseEvent): void {
		const feature = event.features?.[0];
		if (!feature || !layer || !map) return;
		const arc = Number(feature.id);
		map.getCanvas().style.cursor = "pointer";
		popup!
			.setLngLat(event.lngLat)
			.setText(
				`${layer.streetNames[layer.arcStreet[arc]!]} · ${arcSchedule(arc)}`
			)
			.addTo(map);
	}

	function arcSchedule(arc: number): string {
		const l = layer!;
		const rules = [];
		for (
			let j = l.arcRuleOffsets[arc]!;
			j < l.arcRuleOffsets[arc + 1]!;
			j++
		) {
			const r = l.arcRules[j]! * RULE_STRIDE;
			rules.push({
				weekday: l.rules[r]! as Weekday,
				kind: l.rules[r + 1]! as never,
				from: l.rules[r + 2]!,
				to: l.rules[r + 3]!,
			});
		}
		return groupRules(rules)
			.map((g) => prefs.f.ruleShort(g))
			.join(" · ");
	}

	/** Maps per-street review aggregates onto arcs (0 good … 3 not done, 255 none). */
	async function loadReviews(): Promise<void> {
		if (!layer) return;
		summary ??= await api
			.reviewSummary()
			.catch(() => ({ enabled: false, streets: {} }));
		const values = new Uint8Array(layer.arcStreet.length).fill(NO_BAND);
		for (let a = 0; a < values.length; a++) {
			const agg =
				summary.streets[layer.streetSlugs[layer.arcStreet[a]!]!];
			if (!agg || agg.count === 0) continue;
			const { clean, partial, skipped } = agg.outcomes;
			if (skipped / agg.count >= 0.5) values[a] = 3;
			else {
				const score = (clean + partial * 0.5) / agg.count;
				values[a] = score >= 0.75 ? 0 : score >= 0.4 ? 1 : 2;
			}
		}
		reviewValues = values;
		refreshColors();
	}

	$effect(() => {
		// Dependencies: mode, selected day, and the minute tick.
		void app.mapMode;
		void app.dayOffset;
		void app.clock.now.minute;
		if (app.mapMode === "reviews" && !reviewValues) void loadReviews();
		refreshColors();
	});
	$effect(() => {
		void app.selected;
		void app.selectedGroup;
		void wideScreen.current; // the panel moved (sidebar ↔ bottom sheet): refit around it
		refreshSelection();
	});
	$effect(() => {
		void prefs.locale; // relabel the selected street in the new language, without moving the map
		untrack(() => refreshSelection(false, false));
	});
	$effect(() => {
		void app.position;
		// Only a new position recentres: padding() also reads the panel state, which must not.
		untrack(() => refreshPosition());
	});
	$effect(() => {
		const theme = prefs.theme;
		if (map && styleTheme && theme !== styleTheme) {
			styleTheme = theme;
			status = "loading";
			map.setStyle(BASEMAP[theme], { transformStyle: trimBasemap });
		}
	});
	$effect(() => {
		if (status === "ready")
			map?.getCanvas().setAttribute("aria-label", prefs.m.map.canvas);
	});
</script>

<div class="absolute inset-0">
	<div
		bind:this={container}
		class="size-full bg-surface-2"
		role="region"
		aria-label={prefs.m.map.region}
	></div>
	{#if status === "loading" && !loaded}
		<MapLoader label={prefs.m.map.loading} />
	{:else if status === "error"}
		<div
			class="absolute inset-0 grid place-items-center p-6 text-center text-sm"
			role="alert"
		>
			{prefs.m.map.error}
		</div>
	{/if}
</div>
