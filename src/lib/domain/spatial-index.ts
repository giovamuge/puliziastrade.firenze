import type { CityDataset } from './city-dataset';

const METERS_PER_DEG_LAT = 110_574;
const CELL_METERS = 120;

/**
 * Uniform grid over road segments for "which streets are near me?".
 *
 * Built once per dataset version. Queries use pre-allocated scratch buffers
 * and a "touched" list to reset per-street minima, so a lookup performs zero
 * heap allocations regardless of how many segments it scans.
 */
export class SpatialIndex {
	private readonly originLon: number;
	private readonly originLat: number;
	private readonly metersPerDegLon: number;
	private readonly cols: number;
	private readonly rows: number;
	private readonly cellOffsets: Int32Array;
	/** Segment ids = index of the segment's first point. */
	private readonly cellSegments: Int32Array;
	private readonly pointArc: Int32Array;

	// Query scratch space (single-threaded JS: safe to share).
	private readonly streetBest: Float64Array;
	private readonly streetBestArc: Int32Array;
	private readonly touched: Int32Array;

	constructor(private readonly city: CityDataset) {
		const { lon, lat, arcPointOffsets, arcCount } = city;
		let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
		for (let p = 0; p < lon.length; p++) {
			if (lon[p]! < minLon) minLon = lon[p]!;
			if (lon[p]! > maxLon) maxLon = lon[p]!;
			if (lat[p]! < minLat) minLat = lat[p]!;
			if (lat[p]! > maxLat) maxLat = lat[p]!;
		}
		this.originLon = minLon;
		this.originLat = minLat;
		this.metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
		this.cols = Math.max(1, Math.ceil(((maxLon - minLon) * this.metersPerDegLon) / CELL_METERS) + 1);
		this.rows = Math.max(1, Math.ceil(((maxLat - minLat) * METERS_PER_DEG_LAT) / CELL_METERS) + 1);

		this.pointArc = new Int32Array(lon.length);
		for (let a = 0; a < arcCount; a++) this.pointArc.fill(a, arcPointOffsets[a]!, arcPointOffsets[a + 1]!);

		// Two passes (count, fill) → CSR without intermediate arrays per cell.
		const cellCount = this.cols * this.rows;
		this.cellOffsets = new Int32Array(cellCount + 1);
		this.forEachSegmentCell((cell) => this.cellOffsets[cell + 1]!++);
		for (let c = 0; c < cellCount; c++) this.cellOffsets[c + 1]! += this.cellOffsets[c]!;
		this.cellSegments = new Int32Array(this.cellOffsets[cellCount]!);
		const cursor = this.cellOffsets.slice(0, cellCount);
		this.forEachSegmentCell((cell, segment) => {
			this.cellSegments[cursor[cell]!++] = segment;
		});

		this.streetBest = new Float64Array(city.streetCount).fill(Infinity);
		this.streetBestArc = new Int32Array(city.streetCount);
		this.touched = new Int32Array(city.streetCount);
	}

	private col(lonValue: number): number {
		return Math.floor(((lonValue - this.originLon) * this.metersPerDegLon) / CELL_METERS);
	}
	private row(latValue: number): number {
		return Math.floor(((latValue - this.originLat) * METERS_PER_DEG_LAT) / CELL_METERS);
	}

	private forEachSegmentCell(visit: (cell: number, segment: number) => void): void {
		const { lon, lat, arcPointOffsets, arcCount } = this.city;
		for (let a = 0; a < arcCount; a++) {
			for (let p = arcPointOffsets[a]!; p < arcPointOffsets[a + 1]! - 1; p++) {
				const c0 = this.col(Math.min(lon[p]!, lon[p + 1]!));
				const c1 = this.col(Math.max(lon[p]!, lon[p + 1]!));
				const r0 = this.row(Math.min(lat[p]!, lat[p + 1]!));
				const r1 = this.row(Math.max(lat[p]!, lat[p + 1]!));
				for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) visit(r * this.cols + c, p);
			}
		}
	}

	/**
	 * Finds up to `out.capacity` distinct streets within `radiusMeters` of the
	 * point, nearest first. Results are written into `out`; returns the count.
	 */
	nearestStreets(lonValue: number, latValue: number, radiusMeters: number, out: NearestResult): number {
		const { lon, lat } = this.city;
		const kx = this.metersPerDegLon;
		const ky = METERS_PER_DEG_LAT;
		const reach = Math.ceil(radiusMeters / CELL_METERS);
		const c = this.col(lonValue);
		const r = this.row(latValue);
		let touchedCount = 0;

		for (let rr = Math.max(0, r - reach); rr <= Math.min(this.rows - 1, r + reach); rr++) {
			for (let cc = Math.max(0, c - reach); cc <= Math.min(this.cols - 1, c + reach); cc++) {
				const cell = rr * this.cols + cc;
				for (let i = this.cellOffsets[cell]!; i < this.cellOffsets[cell + 1]!; i++) {
					const p = this.cellSegments[i]!;
					// Point–segment distance in a local equirectangular frame (metres).
					const ax = (lon[p]! - lonValue) * kx;
					const ay = (lat[p]! - latValue) * ky;
					const bx = (lon[p + 1]! - lonValue) * kx;
					const by = (lat[p + 1]! - latValue) * ky;
					const dx = bx - ax;
					const dy = by - ay;
					const len2 = dx * dx + dy * dy;
					let t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
					t = t < 0 ? 0 : t > 1 ? 1 : t;
					const px = ax + t * dx;
					const py = ay + t * dy;
					const dist = Math.sqrt(px * px + py * py);
					if (dist > radiusMeters) continue;

					const arc = this.pointArc[p]!;
					const street = this.city.arcStreet[arc]!;
					if (this.streetBest[street] === Infinity) this.touched[touchedCount++] = street;
					if (dist < this.streetBest[street]!) {
						this.streetBest[street] = dist;
						this.streetBestArc[street] = arc;
					}
				}
			}
		}

		// Insertion sort of the touched streets into the bounded output buffer.
		let size = 0;
		for (let i = 0; i < touchedCount; i++) {
			const street = this.touched[i]!;
			const dist = this.streetBest[street]!;
			let pos = size < out.capacity ? size : out.capacity;
			while (pos > 0 && out.distances[pos - 1]! > dist) pos--;
			if (pos < out.capacity) {
				const last = Math.min(size, out.capacity - 1);
				for (let k = last; k > pos; k--) {
					out.streets[k] = out.streets[k - 1]!;
					out.arcs[k] = out.arcs[k - 1]!;
					out.distances[k] = out.distances[k - 1]!;
				}
				out.streets[pos] = street;
				out.arcs[pos] = this.streetBestArc[street]!;
				out.distances[pos] = dist;
				if (size < out.capacity) size++;
			}
			this.streetBest[street] = Infinity; // reset scratch for the next query
		}
		out.size = size;
		return size;
	}
}

/** Reusable, fixed-capacity output buffer for `nearestStreets`. */
export class NearestResult {
	readonly streets: Int32Array;
	readonly arcs: Int32Array;
	readonly distances: Float64Array;
	size = 0;

	constructor(readonly capacity: number) {
		this.streets = new Int32Array(capacity);
		this.arcs = new Int32Array(capacity);
		this.distances = new Float64Array(capacity);
	}
}
