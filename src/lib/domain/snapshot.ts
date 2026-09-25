/**
 * Normalised, persisted form of the open dataset. Produced server-side from the
 * upstream GeoJSON + CKAN metadata, stored (Redis) and kept in memory. Every
 * field of the source is preserved: feature ids, `cod_arco`, street name,
 * schedule, geometry and the dataset/file metadata.
 */

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface SourceMetadata {
	datasetId: string;
	identifier: string;
	title: string;
	description: string;
	author: string;
	maintainer: string;
	maintainerEmail: string;
	licenseTitle: string;
	licenseUrl: string;
	accessRights: string;
	language: string;
	geographicalName: string;
	conformsTo: string;
	themes: string[];
	tags: string[];
	landingPageUrl: string;
	metadataUrl: string;
	resourceName: string;
	resourceFormat: string;
	resourceUrl: string;
	resourceModifiedAt: string | null;
	/** Final URL of the GeoJSON after redirects. */
	fileUrl: string;
	fileLastModified: string | null;
	fileEtag: string | null;
	/** `timeStamp` of the WFS export. */
	fileGeneratedAt: string | null;
	crs: string | null;
	geometryName: string | null;
	totalFeatures: number;
}

export interface StreetRecord {
	slug: string;
	/** Display name, e.g. "Via dell'Argin Grosso". */
	name: string;
	/** Name exactly as in the source (`nome_strada`). */
	rawName: string;
	/** Odonym type, e.g. "Via", "Piazza", "Lungarno". */
	type: string;
}

export interface ArcRecord {
	/** `cod_arco`: identifier of the road segment in the city graph. */
	code: string;
	/** Index into `streets`. */
	street: number;
	/** Source feature ids (`alia_spazzamenti.N`) merged into this segment. */
	featureIds: string[];
	/** Indexes into the flat `rules` buffer (distinct). */
	rules: number[];
}

export interface DataIssue {
	featureId: string;
	field: string;
	value: string;
}

export interface DatasetSnapshot {
	schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
	/** Content version: changes whenever the upstream file changes. */
	version: string;
	refreshedAt: string;
	/** Europe/Rome day number of the last upstream check. */
	refreshedDay: number;
	source: SourceMetadata;
	streets: StreetRecord[];
	/** Flat `[weekday, kind, fromMinute, toMinute]` quadruples. */
	rules: number[];
	arcs: ArcRecord[];
	/** CSR offsets into the point arrays, length = arcs.length + 1. */
	coordOffsets: number[];
	/** Interleaved `[lon, lat]` scaled by 1e6 and rounded (≈ 0.1 m). */
	coords: number[];
	issues: DataIssue[];
}

export const COORD_SCALE = 1e6;
