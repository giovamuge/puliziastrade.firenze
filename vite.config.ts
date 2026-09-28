import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// MapLibre's worker is an ES module importing a shared chunk.
	worker: { format: 'es' },
	// MapLibre GL (~1.05 MB minified, ~280 kB gzip) is one chunk, loaded lazily by the map only:
	// the limit sits just above it, so any other oversized chunk still warns.
	build: { chunkSizeWarningLimit: 1100 },
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
