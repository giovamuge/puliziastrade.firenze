import { CityDataset } from "$lib/domain/city-dataset";
import { readRomeInstant } from "$lib/domain/rome-clock";
import type { DatasetSnapshot } from "$lib/domain/snapshot";
import { SpatialIndex } from "$lib/domain/spatial-index";
import { StreetTopology } from "$lib/domain/street-topology";
import { buildSnapshot } from "../opendata/transform";
import { fetchUpstream } from "../opendata/upstream";
import { StreetSearch } from "../search/street-search";
import { getRedis } from "../redis";
import { waitUntil } from "../wait-until";
import {
	NullSnapshotStore,
	RedisSnapshotStore,
	headOf,
	type SnapshotStore,
} from "./snapshot-store";

/** Everything the API needs, derived once per dataset version. */
export class CityServices {
	readonly city: CityDataset;
	readonly spatial: SpatialIndex;
	readonly search: StreetSearch;
	readonly topology: StreetTopology;

	constructor(readonly snapshot: DatasetSnapshot) {
		this.city = new CityDataset(snapshot);
		this.spatial = new SpatialIndex(this.city);
		this.search = new StreetSearch(snapshot.streets);
		this.topology = new StreetTopology(this.city, this.spatial);
	}

	get version(): string {
		return this.snapshot.version;
	}
}

const LOCK_TTL_SECONDS = 120;
const RETRY_BACKOFF_MS = 15 * 60_000;

/**
 * Serves the processed dataset with a three-level cache:
 *   memory (per instance) → SnapshotStore (Redis, shared) → upstream open data.
 *
 * Refresh policy ("first request of the day"): the first request after
 * midnight (Europe/Rome) gets the current data immediately and triggers a
 * background check upstream (conditional GET, so usually a cheap 304).
 * A daily Vercel Cron hits the same path as a safety net.
 */
export class DatasetService {
	private current: CityServices | null = null;
	/** Europe/Rome day on which `current` was last confirmed up to date. */
	private checkedDay = -1;
	private inflight: Promise<CityServices> | null = null;

	constructor(private readonly store: SnapshotStore) {}

	async get(): Promise<CityServices> {
		const today = romeToday();
		if (this.current) {
			if (this.checkedDay < today) waitUntil(this.refresh(false));
			return this.current;
		}
		return (this.inflight ??= this.coldStart(today).finally(
			() => (this.inflight = null)
		));
	}

	/** Forces an upstream check (used by the cron endpoint). */
	async refreshNow(): Promise<CityServices> {
		return this.refresh(true);
	}

	private async coldStart(today: number): Promise<CityServices> {
		const [stored, head] = await Promise.all([
			this.safeRead(),
			this.store.readHead().catch(() => null),
		]);
		if (stored) {
			this.current = new CityServices(stored);
			this.checkedDay =
				head?.version === stored.version
					? head.refreshedDay
					: stored.refreshedDay;
			if (this.checkedDay < today) waitUntil(this.refresh(false));
			return this.current;
		}
		return this.refresh(true);
	}

	private refreshing: Promise<CityServices> | null = null;

	private lastAttemptAt = 0;

	private refresh(force: boolean): Promise<CityServices> {
		// Back off after a failed/ongoing attempt so a flaky upstream isn't hammered.
		if (
			!force &&
			this.current &&
			Date.now() - this.lastAttemptAt < RETRY_BACKOFF_MS
		)
			return Promise.resolve(this.current);
		this.lastAttemptAt = Date.now();
		return (this.refreshing ??= this.doRefresh(force).finally(
			() => (this.refreshing = null)
		));
	}

	private async doRefresh(force: boolean): Promise<CityServices> {
		const today = romeToday();
		// Another instance may have refreshed already: adopt its result.
		const head = await this.store.readHead().catch(() => null);
		if (head && head.refreshedDay >= today && !force)
			return this.adoptStored(head.version, today);

		const locked = await this.store
			.tryLock(LOCK_TTL_SECONDS)
			.catch(() => true);
		if (!locked && this.current) return this.current;
		try {
			const previous = this.current?.snapshot;
			const payload = await fetchUpstream(
				previous
					? {
							etag: previous.source.fileEtag,
							lastModified: previous.source.fileLastModified,
						}
					: undefined
			);
			if (!payload && previous) {
				// 304 Not Modified: same data, just mark it as checked today.
				await this.store
					.touch({ ...headOf(previous), refreshedDay: today })
					.catch(logStoreError);
				this.checkedDay = today;
				return this.current!;
			}
			if (!payload)
				throw new Error(
					"Upstream returned 304 without a cached snapshot"
				);
			const snapshot = buildSnapshot(
				payload.collection,
				payload.source,
				new Date(),
				today
			);
			if (snapshot.issues.length > 0)
				console.warn(
					`[dataset] ${snapshot.issues.length} record anomali`,
					snapshot.issues.slice(0, 5)
				);
			await this.store.write(snapshot).catch(logStoreError);
			this.current = new CityServices(snapshot);
			this.checkedDay = today;
			return this.current;
		} catch (error) {
			if (this.current) {
				console.error(
					"[dataset] refresh failed, serving stale data",
					error
				);
				return this.current;
			}
			throw error;
		} finally {
			if (locked) await this.store.unlock().catch(logStoreError);
		}
	}

	private async adoptStored(
		version: string,
		today: number
	): Promise<CityServices> {
		if (this.current?.version !== version) {
			const stored = await this.safeRead();
			if (stored) this.current = new CityServices(stored);
		}
		if (!this.current)
			throw new Error("Snapshot head present but data missing");
		this.checkedDay = today;
		return this.current;
	}

	private async safeRead(): Promise<DatasetSnapshot | null> {
		try {
			return await this.store.read();
		} catch (error) {
			logStoreError(error);
			return null;
		}
	}
}

function romeToday(): number {
	return readRomeInstant(Date.now()).day;
}

function logStoreError(error: unknown): void {
	console.error("[dataset] snapshot store error", error);
}

let service: DatasetService | undefined;

export function getDatasetService(): DatasetService {
	if (!service) {
		const redis = getRedis();
		service = new DatasetService(
			redis ? new RedisSnapshotStore(redis) : new NullSnapshotStore()
		);
	}
	return service;
}
