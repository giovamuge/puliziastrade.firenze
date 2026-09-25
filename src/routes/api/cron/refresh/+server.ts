import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getDatasetService } from '$lib/server/dataset/dataset-service';
import { NO_STORE, apiError } from '$lib/server/http';

/**
 * Daily safety net (Vercel Cron, allowed once/day on Hobby). Vercel sends
 * `Authorization: Bearer $CRON_SECRET` when the variable is set.
 */
export const GET: RequestHandler = async ({ request }) => {
	if (env.CRON_SECRET && request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
		return apiError(401, 'unauthorized');
	}
	const { snapshot } = await getDatasetService().refreshNow();
	return json({ version: snapshot.version, refreshedAt: snapshot.refreshedAt, issues: snapshot.issues.length }, { headers: NO_STORE });
};
