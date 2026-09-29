import * as v from "valibot";
import type { SourceMetadata } from "$lib/domain/snapshot";
import {
	CkanPackageSchema,
	SweepingCollectionSchema,
	type CkanPackage,
	type SweepingCollection,
} from "./schemas";

export const DATASET_ID = "pulizia-strade";
const PACKAGE_URL = `https://data.comune.fi.it/datastore/api/package_show?id=${DATASET_ID}&stats=1`;
const LANDING_URL = `https://opendata.comune.fi.it/page_dataset_show?id=${DATASET_ID}`;
/** Used when the catalogue API is down: the direct export behind the download redirect. */
const FALLBACK_GEOJSON_URL =
	"https://datigis.comune.fi.it/json/alia_spazzamenti.json";

const TIMEOUT_MS = 25_000;
const USER_AGENT = "puliziastrade-firenze/0.1 (open data client)";

export interface UpstreamPayload {
	collection: SweepingCollection;
	source: SourceMetadata;
}

export class UpstreamError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "UpstreamError";
	}
}

/** HTTP validators of a previously downloaded file, for conditional requests. */
export interface Validators {
	etag: string | null;
	lastModified: string | null;
}

async function fetchJson(
	url: string,
	validators?: Validators
): Promise<{ body: unknown; response: Response } | null> {
	const headers: Record<string, string> = {
		accept: "application/json",
		"user-agent": USER_AGENT,
	};
	if (validators?.etag) headers["if-none-match"] = validators.etag;
	if (validators?.lastModified)
		headers["if-modified-since"] = validators.lastModified;
	const response = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(TIMEOUT_MS),
		redirect: "follow",
	});
	if (response.status === 304) return null;
	if (!response.ok)
		throw new UpstreamError(`${url} → HTTP ${response.status}`);
	return { body: await response.json(), response };
}

async function fetchPackage(): Promise<CkanPackage | null> {
	try {
		const result = await fetchJson(PACKAGE_URL);
		const parsed = v.safeParse(CkanPackageSchema, result?.body);
		return parsed.success && parsed.output.success ? parsed.output : null;
	} catch (error) {
		console.warn(
			"[upstream] package_show unavailable, using fallback URL",
			error
		);
		return null;
	}
}

/**
 * Downloads catalogue metadata and the GeoJSON export, validating both.
 * Returns `null` when `validators` match the current file (HTTP 304).
 */
export async function fetchUpstream(
	validators?: Validators
): Promise<UpstreamPayload | null> {
	const pkg = await fetchPackage();
	const resource = pkg?.result.resources.find(
		(r) => r.format?.toLowerCase() === "geojson"
	);
	const resourceUrl = resource?.url ?? FALLBACK_GEOJSON_URL;

	const result = await fetchJson(resourceUrl, validators);
	if (!result) return null;
	const { body, response } = result;
	const parsed = v.safeParse(SweepingCollectionSchema, body);
	if (!parsed.success)
		throw new UpstreamError(
			`GeoJSON non valido: ${parsed.issues[0]?.message}`
		);
	const collection = parsed.output;
	const firstFeature = collection.features[0] as
		{ geometry_name?: unknown } | undefined;

	const r = pkg?.result;
	const source: SourceMetadata = {
		datasetId: r?.id ?? DATASET_ID,
		identifier: r?.identifier ?? "",
		title: r?.title || "Pulizia Strade",
		description: r?.description || r?.notes || "",
		author: r?.author ?? "Comune di Firenze",
		maintainer: r?.maintainer ?? "Comune di Firenze",
		maintainerEmail: r?.maintainer_email ?? "",
		licenseTitle: r?.license_title || "CC BY-NC-SA 4.0",
		licenseUrl:
			r?.license_url ||
			"https://creativecommons.org/licenses/by-nc-sa/4.0/",
		accessRights: r?.access_rights ?? "",
		language: r?.language ?? "ITA",
		geographicalName: r?.geographical_name ?? "",
		conformsTo: r?.conforms_to ?? "",
		themes: r?.data_theme ?? [],
		tags: (r?.tags ?? [])
			.map((t) => t.title || t.display_name || "")
			.filter(Boolean),
		landingPageUrl: LANDING_URL,
		metadataUrl: r?.url_xml || PACKAGE_URL,
		resourceName: resource?.name ?? "",
		resourceFormat: resource?.format ?? "GeoJSON",
		resourceUrl,
		resourceModifiedAt: resource?.metadata_modified || null,
		fileUrl: response.url || resourceUrl,
		fileLastModified: response.headers.get("last-modified"),
		fileEtag: response.headers.get("etag"),
		fileGeneratedAt: collection.timeStamp ?? null,
		crs: collection.crs?.properties?.name ?? null,
		geometryName:
			typeof firstFeature?.geometry_name === "string"
				? firstFeature.geometry_name
				: null,
		totalFeatures: collection.totalFeatures ?? collection.features.length,
	};
	return { collection, source };
}
