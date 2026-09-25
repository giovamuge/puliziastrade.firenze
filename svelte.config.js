import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** CSP hash of the inline preferences script in app.html, so it can run before first paint. */
const prefsScript = /<script id="prefs-init">([\s\S]*?)<\/script>/.exec(readFileSync('src/app.html', 'utf8'))?.[1] ?? '';
const prefsHash = `sha256-${createHash('sha256').update(prefsScript).digest('base64')}`;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ runtime: 'nodejs22.x', regions: ['fra1'] }),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', prefsHash],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:', 'https://tiles.openfreemap.org'],
				'font-src': ['self', 'https://tiles.openfreemap.org'],
				'connect-src': ['self', 'https://tiles.openfreemap.org'],
				'worker-src': ['self', 'blob:'],
				'child-src': ['blob:'],
				'frame-ancestors': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		}
	}
};

export default config;
