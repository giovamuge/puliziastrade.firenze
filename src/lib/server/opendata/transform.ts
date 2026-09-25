import * as v from 'valibot';
import type { Weekday } from '$lib/domain/civil-date';
import { WeekKind } from '$lib/domain/schedule';
import {
	COORD_SCALE,
	SNAPSHOT_SCHEMA_VERSION,
	type ArcRecord,
	type DataIssue,
	type DatasetSnapshot,
	type SourceMetadata,
	type StreetRecord
} from '$lib/domain/snapshot';
import { foldText, prettifyStreetName, slugifyStreetName, streetType } from '$lib/domain/street-name';
import { SweepingFeatureSchema, type SweepingCollection } from './schemas';

const WEEKDAYS: Record<string, Weekday> = {
	lunedi: 0,
	martedi: 1,
	mercoledi: 2,
	giovedi: 3,
	venerdi: 4,
	sabato: 5,
	domenica: 6
};

const WEEK_KINDS: Record<string, WeekKind> = {
	'tutte le settimane': WeekKind.Every,
	'prima settimana': WeekKind.Nth1,
	'seconda settimana': WeekKind.Nth2,
	'terza settimana': WeekKind.Nth3,
	'quarta settimana': WeekKind.Nth4,
	'quinta settimana': WeekKind.Nth5,
	'settimane dispari': WeekKind.OddDays,
	'settimane pari': WeekKind.EvenDays
};

const TIME = /^(\d{1,2})[:.](\d{2})/;

function parseMinutes(value: string): number {
	const m = TIME.exec(value.trim());
	if (!m) return -1;
	const minutes = Number(m[1]) * 60 + Number(m[2]);
	return minutes >= 0 && minutes <= 24 * 60 ? minutes : -1;
}

const normalizeKey = (value: string): string => foldText(value).trim().replace(/\s+/g, ' ');

/**
 * Pure transformation GeoJSON → snapshot (Adapter between the upstream format
 * and our domain model). Deterministic for a given input, so the resulting
 * `version` can be derived from the source file identity.
 */
export function buildSnapshot(
	collection: SweepingCollection,
	source: SourceMetadata,
	refreshedAt: Date,
	refreshedDay: number
): DatasetSnapshot {
	const issues: DataIssue[] = [];
	const ruleKeys = new Map<string, number>();
	const rules: number[] = [];
	const streetsByRaw = new Map<string, { raw: string; arcs: Map<string, { coords: [number, number][]; featureIds: string[]; rules: Set<number> }> }>();

	for (const raw of collection.features) {
		const parsed = v.safeParse(SweepingFeatureSchema, raw);
		if (!parsed.success) {
			const id = typeof raw === 'object' && raw && 'id' in raw ? String(raw.id) : '?';
			issues.push({ featureId: id, field: 'feature', value: parsed.issues[0]?.message ?? 'invalid' });
			continue;
		}
		const feature = parsed.output;
		const featureId = String(feature.id);
		const p = feature.properties;

		const rawName = p.nome_strada.trim().replace(/\s+/g, ' ');
		let street = streetsByRaw.get(rawName);
		if (!street) streetsByRaw.set(rawName, (street = { raw: rawName, arcs: new Map() }));

		const code = String(p.cod_arco);
		let arc = street.arcs.get(code);
		if (!arc) {
			arc = { coords: feature.geometry.coordinates, featureIds: [], rules: new Set() };
			street.arcs.set(code, arc);
		}
		arc.featureIds.push(featureId);

		const weekday = WEEKDAYS[normalizeKey(p.giorno)];
		const kind = WEEK_KINDS[normalizeKey(p.settimana)];
		const from = parseMinutes(p.ora_da);
		const to = parseMinutes(p.ora_a);
		if (weekday === undefined) issues.push({ featureId, field: 'giorno', value: p.giorno });
		if (kind === undefined) issues.push({ featureId, field: 'settimana', value: p.settimana });
		if (from < 0) issues.push({ featureId, field: 'ora_da', value: p.ora_da });
		if (weekday === undefined || kind === undefined || from < 0) continue;

		const end = to < 0 ? from : to;
		const key = `${weekday}|${kind}|${from}|${end}`;
		let rule = ruleKeys.get(key);
		if (rule === undefined) {
			rule = rules.length / 4;
			rules.push(weekday, kind, from, end);
			ruleKeys.set(key, rule);
		}
		arc.rules.add(rule);
	}

	const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });
	const sortedStreets = [...streetsByRaw.values()]
		.map((s) => ({ ...s, name: prettifyStreetName(s.raw) }))
		.sort((a, b) => collator.compare(a.name, b.name));

	const streets: StreetRecord[] = [];
	const arcs: ArcRecord[] = [];
	const coordOffsets: number[] = [0];
	const coords: number[] = [];
	const usedSlugs = new Set<string>();

	for (const s of sortedStreets) {
		let slug = slugifyStreetName(s.name);
		for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugifyStreetName(s.name)}-${n}`;
		usedSlugs.add(slug);
		const streetIndex = streets.length;
		streets.push({ slug, name: s.name, rawName: s.raw, type: streetType(s.raw) });

		const codes = [...s.arcs.keys()].sort(collator.compare);
		for (const code of codes) {
			const arc = s.arcs.get(code)!;
			arcs.push({ code, street: streetIndex, featureIds: arc.featureIds, rules: [...arc.rules].sort((a, b) => a - b) });
			for (const [lon, lat] of arc.coords) coords.push(Math.round(lon * COORD_SCALE), Math.round(lat * COORD_SCALE));
			coordOffsets.push(coords.length / 2);
		}
	}

	return {
		schemaVersion: SNAPSHOT_SCHEMA_VERSION,
		version: snapshotVersion(source),
		refreshedAt: refreshedAt.toISOString(),
		refreshedDay,
		source,
		streets,
		rules,
		arcs,
		coordOffsets,
		coords,
		issues
	};
}

/** Stable content identity: prefer the HTTP validators, fall back to the export timestamp. */
export function snapshotVersion(source: Pick<SourceMetadata, 'fileEtag' | 'fileLastModified' | 'fileGeneratedAt' | 'totalFeatures'>): string {
	const basis = `${SNAPSHOT_SCHEMA_VERSION}|` + (source.fileEtag ?? source.fileLastModified ?? source.fileGeneratedAt ?? `n${source.totalFeatures}`);
	let hash = 2166136261;
	for (let i = 0; i < basis.length; i++) hash = Math.imul(hash ^ basis.charCodeAt(i), 16777619);
	return (hash >>> 0).toString(36);
}
