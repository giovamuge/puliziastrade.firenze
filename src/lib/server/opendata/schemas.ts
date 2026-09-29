import * as v from "valibot";

/** Runtime contracts for the upstream CKAN-like API and GeoJSON export. */

const optionalString = v.optional(v.nullable(v.string()), "");

export const CkanResourceSchema = v.object({
	name: optionalString,
	format: optionalString,
	url: v.string(),
	metadata_modified: optionalString,
});

export const CkanPackageSchema = v.object({
	success: v.boolean(),
	result: v.object({
		id: v.string(),
		identifier: optionalString,
		title: optionalString,
		description: optionalString,
		notes: optionalString,
		author: optionalString,
		maintainer: optionalString,
		maintainer_email: optionalString,
		license_title: optionalString,
		license_url: optionalString,
		access_rights: optionalString,
		language: optionalString,
		geographical_name: optionalString,
		conforms_to: optionalString,
		url: optionalString,
		url_xml: optionalString,
		data_theme: v.optional(v.array(v.string()), []),
		tags: v.optional(
			v.array(
				v.object({
					display_name: optionalString,
					title: optionalString,
				})
			),
			[]
		),
		resources: v.array(CkanResourceSchema),
	}),
});
export type CkanPackage = v.InferOutput<typeof CkanPackageSchema>;

export const SweepingFeatureSchema = v.object({
	type: v.literal("Feature"),
	id: v.union([v.string(), v.number()]),
	geometry_name: v.optional(v.string()),
	geometry: v.object({
		type: v.literal("LineString"),
		coordinates: v.array(v.tuple([v.number(), v.number()])),
	}),
	properties: v.object({
		cod_arco: v.union([v.string(), v.number()]),
		nome_strada: v.string(),
		settimana: v.string(),
		giorno: v.string(),
		ora_da: v.string(),
		ora_a: v.string(),
	}),
});
export type SweepingFeature = v.InferOutput<typeof SweepingFeatureSchema>;

/**
 * Top-level collection. Features are validated one by one during the
 * transform so a single malformed record does not reject the whole file.
 */
export const SweepingCollectionSchema = v.object({
	type: v.literal("FeatureCollection"),
	features: v.array(v.unknown()),
	totalFeatures: v.optional(v.number()),
	timeStamp: v.optional(v.string()),
	crs: v.optional(
		v.nullable(
			v.object({
				properties: v.optional(
					v.object({ name: v.optional(v.string()) })
				),
			})
		)
	),
});
export type SweepingCollection = v.InferOutput<typeof SweepingCollectionSchema>;
