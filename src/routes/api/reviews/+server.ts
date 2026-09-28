import * as v from 'valibot';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { ReviewError, ReviewInputSchema, anonymousClientKey, getReviewService } from '$lib/server/reviews/review-service';
import { getReviewTracker } from '$lib/server/reviews/issue-tracker';
import { NO_STORE, apiError, jsonCached, romeNow } from '$lib/server/http';
import { siteOrigin } from '$lib/server/site-url';
import { waitUntil } from '$lib/server/wait-until';

/** `GET /api/reviews?strada=<slug>` — aggregate, latest verifications, verifiable dates. */
export const GET: RequestHandler = async ({ url }) => {
	const { city } = await getDatasetService().get();
	const street = city.streetBySlug(url.searchParams.get('strada') ?? '');
	if (street < 0) return apiError(404, 'not_found');
	const body = await getReviewService().forStreet(city, street, romeNow());
	return jsonCached(body, { cdn: 30, staleWhileRevalidate: 120 });
};

/** `POST /api/reviews` — submit a verification of a sweep that already started. */
export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	if (!request.headers.get('content-type')?.includes('application/json')) return apiError(415, 'unsupported_media');
	const parsed = v.safeParse(ReviewInputSchema, await request.json().catch(() => null));
	if (!parsed.success) return apiError(400, 'invalid_review');

	const { city } = await getDatasetService().get();
	const now = romeNow();
	const clientKey = await anonymousClientKey(getClientAddress(), request.headers.get('user-agent') ?? '', now.day);
	try {
		const review = await getReviewService().submit(city, parsed.output, clientKey, now);
		const tracker = getReviewTracker();
		if (review && tracker) {
			// Moderation copy (GitHub issue) after the response: a slow or failing GitHub never blocks the citizen.
			const page = new URL('/', siteOrigin(url));
			page.searchParams.set('strada', review.street);
			if (review.segment) page.searchParams.set('tratto', review.segment);
			waitUntil(tracker.track({ review, streetName: city.streets[city.streetBySlug(review.street)]!.name, pageUrl: page.href }));
		}
		return json({ review }, { status: 201, headers: NO_STORE });
	} catch (error) {
		if (error instanceof ReviewError) return apiError(error.status, error.code);
		throw error;
	}
};
