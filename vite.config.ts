import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// MapLibre's worker is an ES module importing a shared chunk.
	worker: { format: 'es' },
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
