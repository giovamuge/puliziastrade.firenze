import type { MapLayerDto } from '$lib/api/contracts';
import { MAP_COORD_SCALE } from '$lib/api/contracts';

export interface ArcProperties {
	/** Street index (into `streetSlugs`). */
	s: number;
}

/**
 * Decodes the compact map payload into GeoJSON for MapLibre (built once per
 * dataset version). Feature ids are arc indexes, so styling can be updated
 * via `feature-state` without ever rebuilding this collection.
 */
export function toFeatureCollection(layer: MapLayerDto): GeoJSON.FeatureCollection<GeoJSON.LineString, ArcProperties> {
	const features: GeoJSON.Feature<GeoJSON.LineString, ArcProperties>[] = new Array(layer.arcStreet.length);
	for (let a = 0; a < layer.arcStreet.length; a++) {
		const start = layer.arcPointOffsets[a]!;
		const end = layer.arcPointOffsets[a + 1]!;
		const coordinates: [number, number][] = new Array(end - start);
		let lon = 0;
		let lat = 0;
		for (let p = start; p < end; p++) {
			lon += layer.coords[p * 2]!;
			lat += layer.coords[p * 2 + 1]!;
			coordinates[p - start] = [lon / MAP_COORD_SCALE, lat / MAP_COORD_SCALE];
		}
		features[a] = { type: 'Feature', id: a, properties: { s: layer.arcStreet[a]! }, geometry: { type: 'LineString', coordinates } };
	}
	return { type: 'FeatureCollection', features };
}
