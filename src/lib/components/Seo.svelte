<script lang="ts">
	import { usePreferences } from "$lib/client/preferences.svelte";
	import {
		OG_IMAGE,
		SITE_NAME,
		serializeJsonLd,
		type JsonLd,
	} from "$lib/seo";

	/**
	 * Per-page head tags: title, description, canonical URL, Open Graph /
	 * Twitter card and optional JSON-LD. `origin` comes from the server
	 * (`siteOrigin`), so canonical URLs are absolute and stable across hosts.
	 */
	let {
		title,
		description,
		origin,
		path,
		type = "website",
		jsonLd,
		noindex = false,
	}: {
		title: string;
		description: string;
		origin: string;
		path: string;
		type?: "website" | "article";
		jsonLd?: JsonLd | JsonLd[];
		noindex?: boolean;
	} = $props();

	const prefs = usePreferences();
	const url = $derived(origin + path);
	const image = $derived(origin + OG_IMAGE.path);
	const ogLocale = $derived(
		`${prefs.locale}_${prefs.locale === "en" ? "GB" : prefs.locale.toUpperCase()}`
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta
		name="robots"
		content={noindex
			? "noindex, follow"
			: "index, follow, max-image-preview:large, max-snippet:-1"}
	/>
	<link rel="canonical" href={url} />

	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content={ogLocale} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content={String(OG_IMAGE.width)} />
	<meta property="og:image:height" content={String(OG_IMAGE.height)} />
	<meta property="og:image:alt" content={prefs.m.seo.ogImageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />

	{#if jsonLd}
		<!-- Data block, not executed: CSP script-src does not apply. -->
		{@html `<script type="application/ld+json">${serializeJsonLd(jsonLd)}</script>`}
	{/if}
</svelte:head>
