import type { Config } from "prettier";

/** Same style as the author's other projects (e.g. fetta): tabs, double quotes, 80 columns. */
const config: Config = {
	useTabs: true,
	tabWidth: 4,
	semi: true,
	singleQuote: false,
	trailingComma: "es5",
	printWidth: 80,
	plugins: ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
	overrides: [
		{ files: "*.svelte", options: { parser: "svelte" } },
		// JSON and YAML keep two spaces, as in .editorconfig.
		{
			files: ["*.json", "*.webmanifest", "*.yml", "*.yaml"],
			options: { useTabs: false, tabWidth: 2 },
		},
	],
	// Tailwind 4: the plugin reads the theme from the CSS entry to sort classes.
	tailwindStylesheet: "./src/app.css",
};

export default config;
