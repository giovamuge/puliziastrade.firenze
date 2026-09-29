import type { RequestHandler } from "./$types";
import type { ReviewSummaryResponse } from "$lib/api/contracts";
import { getReviewService } from "$lib/server/reviews/review-service";
import { jsonCached } from "$lib/server/http";

/** Per-street aggregates (current + previous month), for the map "verifiche" view. */
export const GET: RequestHandler = async () => {
	const body: ReviewSummaryResponse = await getReviewService().summary();
	return jsonCached(body, {
		cdn: 300,
		staleWhileRevalidate: 3600,
		browser: 60,
	});
};
