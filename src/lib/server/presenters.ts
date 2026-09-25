import type {
	CleaningWindowDto,
	MapLayerDto,
	MetaDto,
	NearbyItemDto,
	OccurrenceDto,
	RuleDto,
	ScheduleGroupDto,
	StreetDetailDto,
	StreetPartDto,
	StreetSummaryDto
} from '$lib/api/contracts';
import { MAP_COORD_SCALE } from '$lib/api/contracts';
import { toIsoDate, weekdayOf } from '$lib/domain/civil-date';
import type { CityDataset, Occurrence, SoonestOccurrence } from '$lib/domain/city-dataset';
import { groupRules, timeBandOf } from '$lib/domain/describe';
import type { RomeInstant } from '$lib/domain/rome-clock';
import { ruleEffectiveEnd, ruleFrom, ruleMatchesDay, ruleTo } from '$lib/domain/schedule';
import type { NearestResult } from '$lib/domain/spatial-index';
import type { StreetPart, StreetTopology } from '$lib/domain/street-topology';
import type { CityServices } from './dataset/dataset-service';

/** Presenters: map domain structures to API DTOs (the only place that allocates response shapes). */

const scratch: SoonestOccurrence = { day: -1, rule: -1 };

function toWindow(city: CityDataset, occurrence: SoonestOccurrence): CleaningWindowDto | null {
	if (occurrence.day < 0) return null;
	return {
		date: toIsoDate(occurrence.day),
		from: ruleFrom(city.rules, occurrence.rule),
		to: ruleTo(city.rules, occurrence.rule),
		end: ruleEffectiveEnd(city.rules, occurrence.rule)
	};
}

function toRules(city: CityDataset, ruleIds: Iterable<number>): RuleDto[] {
	return groupRules([...ruleIds].map((r) => city.ruleLike(r)));
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

function toPart(city: CityDataset, part: StreetPart, index: number): StreetPartDto {
	return {
		index,
		segments: part.arcs.map((a) => city.arcCodes[a]!),
		lengthMeters: part.lengthMeters,
		bbox: part.bbox.map(round6) as StreetPartDto['bbox'],
		between: part.between
	};
}

export function presentStreetSummary(services: CityServices, street: number, now: RomeInstant): StreetSummaryDto {
	const { city, topology } = services;
	const s = city.streets[street]!;
	const layout = topology.layout(street);
	return {
		slug: s.slug,
		name: s.name,
		type: s.type,
		segmentCount: city.streetArcOffsets[street + 1]! - city.streetArcOffsets[street]!,
		sectionCount: layout.sections.length,
		groupCount: layout.groups.length,
		next: toWindow(city, city.soonestForStreet(street, now.day, now.minute, scratch))
	};
}

export function presentNearby(services: CityServices, result: NearestResult, now: RomeInstant): NearbyItemDto[] {
	const { city, topology } = services;
	const items: NearbyItemDto[] = [];
	for (let i = 0; i < result.size; i++) {
		const street = result.streets[i]!;
		const arc = result.arcs[i]!;
		const layout = topology.layout(street);
		items.push({
			...presentStreetSummary(services, street, now),
			distanceMeters: Math.round(result.distances[i]!),
			segment: city.arcCodes[arc]!,
			segmentNext: toWindow(city, city.soonestForArc(arc, now.day, now.minute, scratch)),
			segmentBetween: layout.groups[layout.arcGroup.get(arc)!]?.between ?? []
		});
	}
	return items;
}

const UPCOMING_DAYS = 62;
const RECENT_DAYS = 3;

function groupNext(city: CityDataset, ruleIds: number[], now: RomeInstant): CleaningWindowDto | null {
	return toWindow(city, city.soonest(Int32Array.from(ruleIds), 0, ruleIds.length, now.day, now.minute, scratch));
}

export function presentStreetDetail(services: CityServices, street: number, now: RomeInstant): StreetDetailDto {
	const { city, topology } = services;
	const record = city.streets[street]!;
	const layout: ReturnType<StreetTopology['layout']> = topology.layout(street);

	const sectionOfArc = new Map<number, number>();
	layout.sections.forEach((s, i) => s.arcs.forEach((a) => sectionOfArc.set(a, i)));

	const groups: ScheduleGroupDto[] = layout.groups.map((g, i) => ({
		...toPart(city, g, i),
		section: g.section,
		rules: toRules(city, g.rules),
		next: groupNext(city, g.rules, now)
	}));

	const arcStart = city.streetArcOffsets[street]!;
	const arcEnd = city.streetArcOffsets[street + 1]!;
	const segments = [];
	for (let i = arcStart; i < arcEnd; i++) {
		const arc = city.streetArcs[i]!;
		segments.push({
			code: city.arcCodes[arc]!,
			featureIds: city.snapshot.arcs[arc]!.featureIds,
			group: layout.arcGroup.get(arc)!,
			section: sectionOfArc.get(arc)!
		});
	}
	const groupOfCode = new Map(segments.map((s) => [s.code, s.group]));

	const toDto = (o: Occurrence): OccurrenceDto => ({
		date: toIsoDate(o.day),
		from: o.from,
		to: o.to,
		end: o.end,
		segments: o.arcCodes,
		groups: [...new Set(o.arcCodes.map((c) => groupOfCode.get(c)!))].sort((a, b) => a - b),
		wholeStreet: o.arcCodes.length === o.totalArcs
	});
	const upcoming = city
		.occurrencesForStreet(street, now.day, now.day + UPCOMING_DAYS)
		.filter((o) => o.day > now.day || o.end > now.minute)
		.map(toDto);
	const recent = city
		.occurrencesForStreet(street, now.day - RECENT_DAYS, now.day)
		.filter((o) => o.day < now.day || o.end <= now.minute)
		.reverse()
		.map(toDto);

	const bbox = layout.sections.reduce<[number, number, number, number]>(
		(acc, s) => [Math.min(acc[0], s.bbox[0]), Math.min(acc[1], s.bbox[1]), Math.max(acc[2], s.bbox[2]), Math.max(acc[3], s.bbox[3])],
		[Infinity, Infinity, -Infinity, -Infinity]
	);

	return {
		...presentStreetSummary(services, street, now),
		rawName: record.rawName,
		rules: toRules(city, city.streetRules.subarray(city.streetRuleOffsets[street]!, city.streetRuleOffsets[street + 1]!)),
		sections: layout.sections.map((s, i) => toPart(city, s, i)),
		groups,
		segments,
		upcoming,
		recent,
		bbox: bbox.map(round6) as StreetDetailDto['bbox'],
		dataVersion: city.version,
		dataUpdatedAt: city.snapshot.source.fileGeneratedAt ?? city.snapshot.source.fileLastModified
	};
}

export function presentMapLayer(city: CityDataset): MapLayerDto {
	const coords: number[] = new Array(city.lon.length * 2);
	for (let a = 0, w = 0; a < city.arcCount; a++) {
		let prevLon = 0;
		let prevLat = 0;
		for (let p = city.arcPointOffsets[a]!; p < city.arcPointOffsets[a + 1]!; p++) {
			const qLon = Math.round(city.lon[p]! * MAP_COORD_SCALE);
			const qLat = Math.round(city.lat[p]! * MAP_COORD_SCALE);
			coords[w++] = qLon - prevLon;
			coords[w++] = qLat - prevLat;
			prevLon = qLon;
			prevLat = qLat;
		}
	}
	return {
		version: city.version,
		streetSlugs: city.streets.map((s) => s.slug),
		streetNames: city.streets.map((s) => s.name),
		rules: Array.from(city.rules),
		arcCodes: [...city.arcCodes],
		arcStreet: Array.from(city.arcStreet),
		arcRuleOffsets: Array.from(city.arcRuleOffsets),
		arcRules: Array.from(city.arcRules),
		arcPointOffsets: Array.from(city.arcPointOffsets),
		coords
	};
}

const matrixCache = new WeakMap<CityDataset, { day: number; matrix: number[][] }>();

/** Average monthly segment-sweeps per weekday × time band, over the next 12 months. */
function weekdayBandMatrix(city: CityDataset, today: number): number[][] {
	const cached = matrixCache.get(city);
	if (cached?.day === today) return cached.matrix;
	const matrix = Array.from({ length: 7 }, () => [0, 0, 0]);
	for (let day = today; day < today + 364; day++) {
		const weekday = weekdayOf(day);
		for (let a = 0; a < city.arcCount; a++) {
			for (let j = city.arcRuleOffsets[a]!; j < city.arcRuleOffsets[a + 1]!; j++) {
				const rule = city.arcRules[j]!;
				if (ruleMatchesDay(city.rules, rule, day)) {
					matrix[weekday]![timeBandOf(ruleFrom(city.rules, rule))]! += 1;
					break;
				}
			}
		}
	}
	const result = matrix.map((row) => row.map((n) => Math.round(n / 12)));
	matrixCache.set(city, { day: today, matrix: result });
	return result;
}

export function presentMeta(services: CityServices, now: RomeInstant, reviewsEnabled: boolean): MetaDto {
	const { snapshot, city } = services;
	return {
		version: snapshot.version,
		refreshedAt: snapshot.refreshedAt,
		source: snapshot.source,
		counts: {
			streets: city.streetCount,
			segments: city.arcCount,
			features: snapshot.source.totalFeatures,
			rules: city.ruleCount,
			issues: snapshot.issues.length
		},
		weekdayBand: weekdayBandMatrix(city, now.day),
		reviewsEnabled
	};
}
