import * as v from "valibot";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import type { NearbyResponse } from "$lib/api/contracts";
import { NearestResult } from "$lib/domain/spatial-index";
import { getDatasetService } from "$lib/server/dataset/dataset-service";
import { presentNearby } from "$lib/server/presenters";
import { NO_STORE, apiError, romeNow } from "$lib/server/http";

const MAX_RESULTS = 5;
const DEFAULT_RADIUS = 150;
/** Reused across requests: the spatial query writes into it without allocating. */
const buffer = new NearestResult(MAX_RESULTS);

const NearbyInputSchema = v.object({
	lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
	lon: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
	radius: v.optional(
		v.pipe(v.number(), v.minValue(20), v.maxValue(500)),
		DEFAULT_RADIUS
	),
});

/**
 * `POST /api/nearby` `{ lat, lon, radius? }` — streets within `radius` metres.
 * POST keeps coordinates out of URLs, hence out of CDN and hosting access
 * logs; the response is never cached and nothing is logged.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = v.safeParse(
		NearbyInputSchema,
		await request.json().catch(() => null)
	);
	if (!parsed.success) return apiError(400, "invalid_coords");
	const { lat, lon, radius } = parsed.output;

	const services = await getDatasetService().get();
	services.spatial.nearestStreets(lon, lat, radius, buffer);
	const body: NearbyResponse = {
		radiusMeters: radius,
		items: presentNearby(services, buffer, romeNow()),
	};
	return json(body, { headers: NO_STORE });
};
