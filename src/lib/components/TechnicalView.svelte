<script lang="ts">
	import { usePreferences } from '$lib/client/preferences.svelte';
	import { useStreetModel } from '$lib/client/street-model.svelte';

	/** Raw identifiers from the open data, for transparency and bug reports. */
	const prefs = usePreferences();
	const model = useStreetModel();
	const street = $derived(model.street!);
	const m = $derived(prefs.m.street);
</script>

<dl class="card divide-border divide-y text-sm">
	{#each [[m.rawName, street.rawName], [m.lengthLabel, prefs.f.distance(model.totalLength)], [m.arcCodes, street.segments.map((s) => s.code).join(', ')], [m.sourceRecords, street.segments.flatMap((s) => s.featureIds).join(', ')], [m.dataVersion, street.dataVersion]] as [label, value] (label)}
		<div class="grid gap-1 p-3">
			<dt class="text-muted text-xs font-semibold tracking-wide uppercase">{label}</dt>
			<dd class="font-mono text-xs break-all">{value}</dd>
		</div>
	{/each}
</dl>
