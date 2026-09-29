import { env } from "$env/dynamic/private";
import type { ReviewDto } from "$lib/api/contracts";
import { formatMinutes } from "$lib/domain/civil-date";
import { formatterFor } from "$lib/i18n";

/**
 * Copies every accepted citizen report into a moderation queue, so the
 * maintainer can review it before forwarding it (aggregated) to the
 * responsible body. Reports stay anonymous: no IP or client key is sent.
 */
export interface ReviewTracker {
	track(report: TrackedReport): Promise<void>;
}

export interface TrackedReport {
	review: ReviewDto;
	streetName: string;
	/** Absolute URL of the street page (with the segment, if any). */
	pageUrl: string;
}

/** Main label that marks report issues; reviewing labels (e.g. "approvata") are added by hand. */
export const DEFAULT_REPORT_LABEL = "segnalazione";

/** Report text is user input: neutralise mentions, references and markup before it lands in GitHub. */
export function escapeMarkdown(text: string): string {
	return text
		.replace(/([\\`*_{}[\]()<>#+!|~])/g, "\\$1")
		.replace(/@/g, "@\u200b")
		.replace(/#(?=\d)/g, "#\u200b");
}

/** Italian issue title and body: the queue is reviewed by the maintainer, in Italian. */
export function formatIssue({ review, streetName, pageUrl }: TrackedReport): {
	title: string;
	body: string;
} {
	const m = formatterFor("it").m.reviews;
	const outcome = m.outcomes[review.outcome].label;
	const rows: [string, string][] = [
		["Via", `[${escapeMarkdown(streetName)}](${pageUrl})`],
		["Tratto", review.segment ? `\`${review.segment}\`` : "tutta la via"],
		["Data del passaggio", review.date],
		["Esito", outcome],
		["Voto", review.rating ? `${review.rating}/5` : "—"],
		[
			"Orario sul cartello",
			review.signWindow
				? `${formatMinutes(review.signWindow.from)}–${formatMinutes(review.signWindow.to)} (diverso dai dati)`
				: "—",
		],
		["Ricevuta", review.createdAt],
		["ID", `\`${review.id}\``],
	];
	const body = [
		"| Campo | Valore |",
		"| --- | --- |",
		...rows.map(([k, v]) => `| ${k} | ${v} |`),
		"",
		"### Nota del cittadino",
		review.note ? `> ${escapeMarkdown(review.note)}` : "_Nessuna nota._",
		"",
		"---",
		"_Segnalazione anonima inviata dall’app. Rivedi la nota (può contenere dati personali) prima di inoltrarla all’ente._",
	].join("\n");
	return { title: `${streetName} · ${review.date} · ${outcome}`, body };
}

export class GitHubIssueTracker implements ReviewTracker {
	constructor(
		private readonly repo: string,
		private readonly token: string,
		private readonly label: string,
		private readonly fetchFn: typeof fetch = fetch
	) {}

	async track(report: TrackedReport): Promise<void> {
		const { title, body } = formatIssue(report);
		const response = await this.fetchFn(
			`https://api.github.com/repos/${this.repo}/issues`,
			{
				method: "POST",
				headers: {
					accept: "application/vnd.github+json",
					authorization: `Bearer ${this.token}`,
					"content-type": "application/json",
					"user-agent": "puliziastrade-firenze",
					"x-github-api-version": "2022-11-28",
				},
				body: JSON.stringify({ title, body, labels: [this.label] }),
			}
		);
		if (!response.ok)
			throw new Error(
				`GitHub issue creation failed: ${response.status} ${await response.text()}`
			);
	}
}

let tracker: ReviewTracker | null | undefined;

/** Configured tracker, or null when the GitHub variables are not set (reports are still stored). */
export function getReviewTracker(): ReviewTracker | null {
	if (tracker !== undefined) return tracker;
	const repo = env.GITHUB_ISSUES_REPO;
	const token = env.GITHUB_ISSUES_TOKEN;
	tracker =
		repo && token && /^[\w.-]+\/[\w.-]+$/.test(repo)
			? new GitHubIssueTracker(
					repo,
					token,
					env.GITHUB_ISSUES_LABEL || DEFAULT_REPORT_LABEL
				)
			: null;
	return tracker;
}
