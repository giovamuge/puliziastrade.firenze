import type { RequestHandler } from './$types';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { presentMapLayer } from '$lib/server/presenters';
import { cacheHeaders } from '$lib/server/http';
import type { CityDataset } from '$lib/domain/city-dataset';

/** Serialised once per dataset version and kept in memory. */
const serialized = new WeakMap<CityDataset, string>();

export const GET: RequestHandler = async ({ request }) => {
	const { city } = await getDatasetService().get();
	const etag = `"map-${city.version}"`;
	const headers = { ...cacheHeaders({ cdn: 3600, staleWhileRevalidate: 7 * 86400, browser: 600 }), etag };
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

	let body = serialized.get(city);
	if (!body) serialized.set(city, (body = JSON.stringify(presentMapLayer(city))));
	return new Response(body, { headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
};
