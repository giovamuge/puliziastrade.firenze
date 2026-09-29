/**
 * End-to-end check of the data pipeline against a real export.
 * Run with: DATA_FILE=/path/alia_spazzamenti.json npx vitest run pipeline
 */
import { readFileSync } from "node:fs";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { CityDataset } from "$lib/domain/city-dataset";
import { parseIsoDate } from "$lib/domain/civil-date";
import { NearestResult, SpatialIndex } from "$lib/domain/spatial-index";
import { SweepingCollectionSchema } from "./opendata/schemas";
import { buildSnapshot } from "./opendata/transform";
import { StreetSearch } from "./search/street-search";
import { presentMapLayer, presentStreetDetail } from "./presenters";
import { buildStreetCalendar } from "./calendar";
import { CityServices } from "./dataset/dataset-service";
import { formatterFor } from "$lib/i18n";
import { StreetTopology } from "$lib/domain/street-topology";

const file = process.env.DATA_FILE;

describe.skipIf(!file)("pipeline on real data", () => {
	// The body is still evaluated when skipped: bail out before touching the file.
	if (!file) return;
	const collection = v.parse(
		SweepingCollectionSchema,
		JSON.parse(readFileSync(file, "utf8"))
	);
	const source = {
		datasetId: "pulizia-strade",
		identifier: "",
		title: "Pulizia Strade",
		description: "",
		author: "",
		maintainer: "",
		maintainerEmail: "",
		licenseTitle: "",
		licenseUrl: "",
		accessRights: "",
		language: "",
		geographicalName: "",
		conformsTo: "",
		themes: [],
		tags: [],
		landingPageUrl: "",
		metadataUrl: "",
		resourceName: "",
		resourceFormat: "GeoJSON",
		resourceUrl: "",
		resourceModifiedAt: null,
		fileUrl: "",
		fileLastModified: null,
		fileEtag: "x",
		fileGeneratedAt: collection.timeStamp ?? null,
		crs: null,
		geometryName: "geom",
		totalFeatures: collection.features.length,
	};
	const today = parseIsoDate("2026-09-24");
	const t0 = performance.now();
	const snapshot = buildSnapshot(collection, source, new Date(), today);
	const city = new CityDataset(snapshot);
	const spatial = new SpatialIndex(city);
	const search = new StreetSearch(snapshot.streets);
	const buildMs = performance.now() - t0;

	it("keeps every feature", () => {
		const featureIds = snapshot.arcs.reduce(
			(n, a) => n + a.featureIds.length,
			0
		);
		console.log({
			buildMs: Math.round(buildMs),
			streets: city.streetCount,
			arcs: city.arcCount,
			rules: city.ruleCount,
			issues: snapshot.issues.length,
			featureIds,
			snapshotBytes: JSON.stringify(snapshot).length,
			mapBytes: JSON.stringify(presentMapLayer(city)).length,
		});
		expect(featureIds).toBe(collection.features.length);
		expect(snapshot.issues).toEqual([]);
	});

	it("finds streets with abbreviations and typos", () => {
		const name = (q: string) =>
			snapshot.streets[search.search(q, 1)[0]!.street]!.name;
		expect(name("perugino")).toBe("Via del Perugino");
		expect(name("v. del perugino")).toBe("Via del Perugino");
		expect(name("argin gross")).toBe("Via dell'Argin Grosso");
		expect(name("lungarno ferruci")).toBe("Lungarno Francesco Ferrucci");
		console.log(
			"p.za santo spirito →",
			search
				.search("p.za santo spirito", 3)
				.map((m) => snapshot.streets[m.street]!.name)
		);
	});

	it("locates nearby streets without allocating", () => {
		const out = new NearestResult(5);
		// Piazza Santo Spirito
		spatial.nearestStreets(11.2479, 43.7672, 150, out);
		const names = Array.from(
			out.streets.subarray(0, out.size),
			(s) => snapshot.streets[s]!.name
		);
		console.log(
			"near Santo Spirito",
			names,
			Array.from(out.distances.subarray(0, out.size), Math.round)
		);
		expect(out.size).toBeGreaterThan(0);
		const t = performance.now();
		for (let i = 0; i < 1000; i++)
			spatial.nearestStreets(11.25 + i * 1e-5, 43.77, 150, out);
		console.log(
			"1000 nearby queries ms",
			Math.round(performance.now() - t)
		);
	});

	it("produces details and calendars", () => {
		const services = new CityServices(snapshot);
		const street = city.streetBySlug("via-del-saletto");
		const detail = presentStreetDetail(services, street, {
			day: today,
			minute: 600,
		});
		console.log(
			JSON.stringify(
				detail.groups.map((g) => ({
					between: g.between,
					rules: g.rules,
					next: g.next,
				}))
			)
		);
		console.log(detail.upcoming.slice(0, 3));
		expect(detail.groups).toHaveLength(2);
		expect(detail.upcoming[0]!.groups).toEqual([0]);
		const ics = buildStreetCalendar(city, {
			street,
			arcs: new Set(services.topology.layout(street).groups[0]!.arcs),
			rules: [],
			scopeLabel: "tra A e B",
			scopeId: "264161",
			alarm: "auto",
			now: { day: today, minute: 600 },
			pageUrl: "https://example.org",
			f: formatterFor("en"),
		});
		expect(ics).toContain(
			"SUMMARY:Street cleaning: Via del Saletto (tra A e B)"
		);
		expect(ics).not.toContain("20261028");
		expect(
			ics
				.split("\r\n")
				.every((l) => new TextEncoder().encode(l).length <= 75)
		).toBe(true);
	});

	it("splits streets into sections and schedule groups", () => {
		const topology = new StreetTopology(city, spatial);
		const show = (slug: string) => {
			const layout = topology.layout(city.streetBySlug(slug));
			console.log(
				slug,
				"sections:",
				layout.sections.map(
					(s) =>
						`${s.arcs.length} arcs ${s.lengthMeters}m [${s.between.join(" | ")}]`
				)
			);
			console.log(
				"  groups:",
				layout.groups.map(
					(g) =>
						`${g.arcs.map((a) => city.arcCodes[a]).join(",")} rules=${g.rules} sec=${g.section} [${g.between.join(" | ")}]`
				)
			);
			return layout;
		};
		const saletto = show("via-del-saletto");
		expect(saletto.sections).toHaveLength(1);
		expect(saletto.groups).toHaveLength(2);
		expect(show("via-benedetto-fortini").sections).toHaveLength(2);
		show("via-senese");
		show("via-dei-serragli");
		const t = performance.now();
		for (let s = 0; s < city.streetCount; s++) topology.layout(s);
		console.log("all layouts ms", Math.round(performance.now() - t));
	});
});
