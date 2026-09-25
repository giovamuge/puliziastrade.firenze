import type { RequestHandler } from './$types';
import type { SearchResponse } from '$lib/api/contracts';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { presentStreetSummary } from '$lib/server/presenters';
import { apiError, jsonCached, romeNow } from '$lib/server/http';

const MAX_QUERY = 80;

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
	const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 8));
	if (query.length < 2) return apiError(400, 'invalid_query');

	const services = await getDatasetService().get();
	const now = romeNow();
	const body: SearchResponse = {
		query,
		results: services.search.search(query, limit).map((m) => presentStreetSummary(services, m.street, now))
	};
	// Short CDN TTL: results embed the "next sweep", which moves with time.
	return jsonCached(body, { cdn: 300, staleWhileRevalidate: 600, browser: 60 });
};
