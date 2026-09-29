import { describe, expect, it } from "vitest";
import { prettifyStreetName, slugifyStreetName } from "./street-name";

describe("street names", () => {
	it("title-cases Italian odonyms", () => {
		expect(prettifyStreetName("VIA DELL'ARGIN GROSSO")).toBe(
			"Via dell'Argin Grosso"
		);
		expect(prettifyStreetName("VIA DEL PERUGINO")).toBe("Via del Perugino");
		expect(prettifyStreetName("PIAZZA NICCOLO' ACCIAIUOLI")).toBe(
			"Piazza Niccolò Acciaiuoli"
		);
		expect(prettifyStreetName("VIA DELL'ORTO")).toBe("Via dell'Orto");
		expect(prettifyStreetName("VIA DEL PRESTO DI SAN MARTINO")).toBe(
			"Via del Presto di San Martino"
		);
		expect(prettifyStreetName("VIALE PAPA GIOVANNI XXIII")).toBe(
			"Viale Papa Giovanni XXIII"
		);
		expect(prettifyStreetName("LUNGARNO  FRANCESCO FERRUCCI")).toBe(
			"Lungarno Francesco Ferrucci"
		);
	});

	it("builds ASCII slugs", () => {
		expect(slugifyStreetName("Via dell'Argin Grosso")).toBe(
			"via-dell-argin-grosso"
		);
		expect(slugifyStreetName("Piazza Niccolò Tommaseo")).toBe(
			"piazza-niccolo-tommaseo"
		);
	});
});
