import type { Redis } from "@upstash/redis";
import {
	SNAPSHOT_SCHEMA_VERSION,
	type DatasetSnapshot,
} from "$lib/domain/snapshot";

/** Small record used to check freshness across instances without downloading the snapshot. */
export interface SnapshotHead {
	version: string;
	refreshedDay: number;
	etag: string | null;
	lastModified: string | null;
}

/** Persistence port for the processed dataset (Dependency Inversion). */
export interface SnapshotStore {
	readHead(): Promise<SnapshotHead | null>;
	read(): Promise<DatasetSnapshot | null>;
	write(snapshot: DatasetSnapshot): Promise<void>;
	/** Marks the current snapshot as checked today (upstream answered 304). */
	touch(head: SnapshotHead): Promise<void>;
	/** Cross-instance mutex for refreshes; returns false if another instance holds it. */
	tryLock(ttlSeconds: number): Promise<boolean>;
	unlock(): Promise<void>;
}

export function headOf(snapshot: DatasetSnapshot): SnapshotHead {
	return {
		version: snapshot.version,
		refreshedDay: snapshot.refreshedDay,
		etag: snapshot.source.fileEtag,
		lastModified: snapshot.source.fileLastModified,
	};
}

const PREFIX = `ps:v${SNAPSHOT_SCHEMA_VERSION}`;
const KEY_SNAPSHOT = `${PREFIX}:snapshot`;
const KEY_HEAD = `${PREFIX}:head`;
const KEY_LOCK = `${PREFIX}:refresh-lock`;

export class RedisSnapshotStore implements SnapshotStore {
	constructor(private readonly redis: Redis) {}

	async readHead(): Promise<SnapshotHead | null> {
		const raw = await this.redis.get<string>(KEY_HEAD);
		return raw ? (JSON.parse(raw) as SnapshotHead) : null;
	}

	async read(): Promise<DatasetSnapshot | null> {
		const raw = await this.redis.get<string>(KEY_SNAPSHOT);
		if (!raw) return null;
		const snapshot = JSON.parse(raw) as DatasetSnapshot;
		return snapshot.schemaVersion === SNAPSHOT_SCHEMA_VERSION
			? snapshot
			: null;
	}

	async write(snapshot: DatasetSnapshot): Promise<void> {
		// Snapshot first, head last: readers never see a head without its data.
		await this.redis.set(KEY_SNAPSHOT, JSON.stringify(snapshot));
		await this.redis.set(KEY_HEAD, JSON.stringify(headOf(snapshot)));
	}

	async touch(head: SnapshotHead): Promise<void> {
		await this.redis.set(KEY_HEAD, JSON.stringify(head));
	}

	async tryLock(ttlSeconds: number): Promise<boolean> {
		return (
			(await this.redis.set(KEY_LOCK, "1", {
				nx: true,
				ex: ttlSeconds,
			})) === "OK"
		);
	}

	async unlock(): Promise<void> {
		await this.redis.del(KEY_LOCK);
	}
}

/** Used when no persistent store is configured: the in-memory cache is all we have. */
export class NullSnapshotStore implements SnapshotStore {
	readHead = async (): Promise<null> => null;
	read = async (): Promise<null> => null;
	write = async (): Promise<void> => {};
	touch = async (): Promise<void> => {};
	tryLock = async (): Promise<boolean> => true;
	unlock = async (): Promise<void> => {};
}
