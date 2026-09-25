import type { RequestHandler } from './$types';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { presentStreetDetail } from '$lib/server/presenters';
import { apiError, jsonCached, romeNow } from '$lib/server/http';

export const GET: RequestHandler = async ({ params }) => {
	const services = await getDatasetService().get();
	const street = services.city.streetBySlug(params.slug);
	if (street < 0) return apiError(404, 'not_found');
	return jsonCached(presentStreetDetail(services, street, romeNow()), { cdn: 600, staleWhileRevalidate: 3600, browser: 60 });
};
