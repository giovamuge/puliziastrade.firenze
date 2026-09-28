import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { NO_STORE, apiError } from '$lib/server/http';

/**
 * Daily safety net (Vercel Cron, allowed once/day on Hobby). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; in production the variable is required.
 */
export const GET: RequestHandler = async ({ request }) => {
	// Outside development the secret is required: an open endpoint would let anyone force
	// repeated downloads from the City's server and burn function time.
	const secret = env.CRON_SECRET;
	const authorized = secret ? request.headers.get('authorization') === `Bearer ${secret}` : dev;
	if (!authorized) return apiError(401, 'unauthorized');
	const { snapshot } = await getDatasetService().refreshNow();
	return json({ version: snapshot.version, refreshedAt: snapshot.refreshedAt, issues: snapshot.issues.length }, { headers: NO_STORE });
};
