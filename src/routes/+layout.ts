import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';

/**
 * Vercel Web Analytics: cookieless page views, including client-side navigations.
 * Production only: in development the debug script comes from va.vercel-scripts.com,
 * which the CSP blocks (and there is nothing to measure locally).
 */
if (!dev) injectAnalytics({ mode: 'production' });
