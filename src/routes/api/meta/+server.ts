import type { RequestHandler } from './$types';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { getReviewService } from '$lib/server/reviews/review-service';
import { presentMeta } from '$lib/server/presenters';
import { jsonCached, romeNow, secondsUntilRomeMidnight } from '$lib/server/http';

export const GET: RequestHandler = async () => {
	const services = await getDatasetService().get();
	const now = romeNow();
	return jsonCached(presentMeta(services, now, getReviewService().enabled), {
		cdn: Math.min(3600, secondsUntilRomeMidnight(now)),
		staleWhileRevalidate: 86400,
		browser: 300
	});
};
