import type { CityDataset } from './city-dataset';
import { NearestResult, type SpatialIndex } from './spatial-index';

/**
 * Street topology: turns the flat list of segments (`cod_arco`) that share a
 * street name into structures people understand.
 *
 * - **Sections**: connected pieces of the street. The same name can appear in
 *   disconnected places (86 names in the current data, up to 2 km apart),
 *   either because the city graph has gaps or because they are different
 *   roads with the same odonym.
 * - **Schedule groups**: contiguous runs of segments sharing exactly the same
 *   rules. 172 streets have different days/times per segment (e.g. Via del
 *   Saletto: two segments on the 4th Thursday 07–12, one on the 4th
 *   Wednesday 13–18).
 *
 * Each part is labelled by the streets crossing its two farthest ends
 * ("tra Via X e Via Y"), found with the spatial index.
 */

const METERS_PER_DEG_LAT = 110_574;
/** Two segments touch when an endpoint of one lies this close to a vertex of the other. */
const JOIN_METERS = 15;
/** Endpoints closer than this are the same graph node. */
const NODE_METERS = 3;
/** Search radius for cross streets at a part's ends. */
const CROSS_METERS = 20;

export interface StreetPart {
	arcs: number[];
	lengthMeters: number;
	/** `[west, south, east, north]` */
	bbox: [number, number, number, number];
	/** Names of the streets crossing the two farthest ends (0–2, distinct). */
	between: string[];
}

export interface ScheduleGroup extends StreetPart {
	/** Sorted distinct rule ids. */
	rules: number[];
	/** Index into `StreetLayout.sections`. */
	section: number;
}

export interface StreetLayout {
	sections: StreetPart[];
	groups: ScheduleGroup[];
	/** arc index → group index */
	arcGroup: Map<number, number>;
}

export class StreetTopology {
	private readonly cache = new Map<number, StreetLayout>();
	private readonly nearest = new NearestResult(6);
	private readonly kx: number;

	constructor(
		private readonly city: CityDataset,
		private readonly spatial: SpatialIndex
	) {
		this.kx = METERS_PER_DEG_LAT * Math.cos((43.77 * Math.PI) / 180);
	}

	layout(street: number): StreetLayout {
		let layout = this.cache.get(street);
		if (!layout) this.cache.set(street, (layout = this.compute(street)));
		return layout;
	}

	private compute(street: number): StreetLayout {
		const { city } = this;
		const arcs = Array.from(city.streetArcs.subarray(city.streetArcOffsets[street]!, city.streetArcOffsets[street + 1]!));

		const sectionOf = this.components(arcs, () => true);
		const sectionArcs = groupBy(arcs, (a) => sectionOf.get(a)!);
		const sections = [...sectionArcs.values()].map((list) => this.describe(list, street));

		const signature = (a: number) => Array.from(city.arcRules.subarray(city.arcRuleOffsets[a]!, city.arcRuleOffsets[a + 1]!)).join(',');
		const groupOf = this.components(arcs, (a, b) => signature(a) === signature(b));
		const sectionIndex = new Map<number, number>();
		[...sectionArcs.keys()].forEach((root, i) => sectionIndex.set(root, i));

		const groups: ScheduleGroup[] = [];
		const arcGroup = new Map<number, number>();
		for (const list of groupBy(arcs, (a) => groupOf.get(a)!).values()) {
			const first = list[0]!;
			const index = groups.length;
			for (const a of list) arcGroup.set(a, index);
			groups.push({
				...this.describe(list, street),
				rules: signature(first).split(',').filter(Boolean).map(Number),
				section: sectionIndex.get(sectionOf.get(first)!)!
			});
		}
		// Stable, readable order: by section, then west→east / south→north.
		const order = groups
			.map((g, i) => ({ g, i }))
			.sort((x, y) => x.g.section - y.g.section || x.g.bbox[0] - y.g.bbox[0] || x.g.bbox[1] - y.g.bbox[1]);
		const remap = new Map(order.map(({ i }, k) => [i, k]));
		for (const [arc, g] of arcGroup) arcGroup.set(arc, remap.get(g)!);

		return { sections, groups: order.map(({ g }) => g), arcGroup };
	}

	/** Union-find over `arcs`, joining touching arcs for which `compatible` holds. */
	private components(arcs: number[], compatible: (a: number, b: number) => boolean): Map<number, number> {
		const parent = new Map(arcs.map((a) => [a, a]));
		const find = (a: number): number => {
			let root = a;
			while (parent.get(root) !== root) root = parent.get(root)!;
			parent.set(a, root);
			return root;
		};
		for (let i = 0; i < arcs.length; i++) {
			for (let j = i + 1; j < arcs.length; j++) {
				const a = arcs[i]!;
				const b = arcs[j]!;
				if (find(a) !== find(b) && compatible(a, b) && this.touches(a, b)) parent.set(find(a), find(b));
			}
		}
		return new Map(arcs.map((a) => [a, find(a)]));
	}

	private touches(a: number, b: number): boolean {
		return this.endpointNearArc(a, b) || this.endpointNearArc(b, a);
	}

	private endpointNearArc(from: number, to: number): boolean {
		const { arcPointOffsets: off } = this.city;
		for (const p of [off[from]!, off[from + 1]! - 1]) {
			for (let q = off[to]!; q < off[to + 1]!; q++) if (this.distance(p, q) <= JOIN_METERS) return true;
		}
		return false;
	}

	private distance(p: number, q: number): number {
		const { lon, lat } = this.city;
		return Math.hypot((lon[p]! - lon[q]!) * this.kx, (lat[p]! - lat[q]!) * METERS_PER_DEG_LAT);
	}

	private describe(arcs: number[], street: number): StreetPart {
		const { lon, lat, arcPointOffsets: off } = this.city;
		let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity, length = 0;
		const endpoints: number[] = [];
		for (const a of arcs) {
			for (let p = off[a]!; p < off[a + 1]!; p++) {
				west = Math.min(west, lon[p]!);
				east = Math.max(east, lon[p]!);
				south = Math.min(south, lat[p]!);
				north = Math.max(north, lat[p]!);
				if (p > off[a]!) length += this.distance(p - 1, p);
			}
			endpoints.push(off[a]!, off[a + 1]! - 1);
		}
		// Terminal nodes: endpoints not shared with another endpoint of the part.
		const terminals = endpoints.filter((p) => endpoints.filter((q) => q !== p && this.distance(p, q) <= NODE_METERS).length === 0);
		const candidates = terminals.length >= 2 ? terminals : endpoints;
		let best: [number, number] = [candidates[0]!, candidates[0]!];
		let bestDistance = -1;
		for (let i = 0; i < candidates.length; i++) {
			for (let j = i + 1; j < candidates.length; j++) {
				const d = this.distance(candidates[i]!, candidates[j]!);
				if (d > bestDistance) {
					bestDistance = d;
					best = [candidates[i]!, candidates[j]!];
				}
			}
		}
		const between: string[] = [];
		for (const p of best[0] === best[1] ? [best[0]] : best) {
			const name = this.crossStreetAt(p, street);
			if (name && !between.includes(name)) between.push(name);
		}
		return { arcs, lengthMeters: Math.round(length), bbox: [west, south, east, north], between };
	}

	private crossStreetAt(point: number, street: number): string | null {
		const size = this.spatial.nearestStreets(this.city.lon[point]!, this.city.lat[point]!, CROSS_METERS, this.nearest);
		for (let i = 0; i < size; i++) {
			const other = this.nearest.streets[i]!;
			if (other !== street && this.city.streets[other]!.name !== this.city.streets[street]!.name) return this.city.streets[other]!.name;
		}
		return null;
	}
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
	const map = new Map<number, T[]>();
	for (const item of items) {
		const k = key(item);
		const list = map.get(k);
		if (list) list.push(item);
		else map.set(k, [item]);
	}
	return map;
}
