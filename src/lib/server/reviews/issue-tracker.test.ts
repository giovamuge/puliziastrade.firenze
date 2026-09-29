import { describe, expect, it, vi } from "vitest";
import type { ReviewDto } from "$lib/api/contracts";
import {
	escapeMarkdown,
	formatIssue,
	GitHubIssueTracker,
} from "./issue-tracker";

const review: ReviewDto = {
	id: "abc",
	street: "via-del-saletto",
	segment: "264161",
	date: "2026-09-28",
	outcome: "dirty",
	rating: 2,
	note: "Foglie ovunque @someone #12 <b>",
	signWindow: { from: 420, to: 720 },
	createdAt: "2026-09-28T10:00:00.000Z",
};
const report = {
	review,
	streetName: "Via del Saletto",
	pageUrl: "https://example.org/?strada=via-del-saletto",
};

describe("formatIssue", () => {
	it("builds an Italian title and a table with every field", () => {
		const { title, body } = formatIssue(report);
		expect(title).toBe("Via del Saletto · 2026-09-28 · Passati, ma sporca");
		expect(body).toContain("| Tratto | `264161` |");
		expect(body).toContain("| Voto | 2/5 |");
		expect(body).toContain("07:00–12:00 (diverso dai dati)");
	});

	it("neutralises mentions, issue references and markup in the note", () => {
		const { body } = formatIssue(report);
		expect(body).not.toContain("@someone");
		expect(body).not.toMatch(/(^|[^\\])#12/);
		expect(body).not.toContain("<b>");
	});
});

describe("escapeMarkdown", () => {
	it("escapes table and link syntax", () => {
		expect(escapeMarkdown("a|b [x](y)")).toBe("a\\|b \\[x\\]\\(y\\)");
	});
});

describe("GitHubIssueTracker", () => {
	it("creates an issue with the report label", async () => {
		const fetchFn = vi.fn(async () => new Response("{}", { status: 201 }));
		await new GitHubIssueTracker(
			"owner/repo",
			"tok",
			"segnalazione",
			fetchFn as typeof fetch
		).track(report);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe("https://api.github.com/repos/owner/repo/issues");
		expect((init.headers as Record<string, string>).authorization).toBe(
			"Bearer tok"
		);
		expect(JSON.parse(init.body as string).labels).toEqual([
			"segnalazione",
		]);
	});

	it("throws on API errors so waitUntil logs them", async () => {
		const fetchFn = vi.fn(
			async () => new Response("Bad credentials", { status: 401 })
		);
		await expect(
			new GitHubIssueTracker(
				"owner/repo",
				"bad",
				"segnalazione",
				fetchFn as typeof fetch
			).track(report)
		).rejects.toThrow("401");
	});
});
