import { idb, localKv } from '@/lib/db';
import { formatBytes } from '@/lib/time';

export { localKv };

/** Repositories over IndexedDB: projects, media assets, and app state. */

export async function listRecords<T>(store: string): Promise<T[]> {
  try {
    return await idb.getAll<T>(store);
  } catch {
    return [];
  }
}

export async function putRecord<T extends { id?: string }>(store: string, record: T): Promise<void> {
  await idb.put(store, record);
}

export async function deleteRecord(store: string, id: string): Promise<void> {
  await idb.del(store, id);
}

export async function clearStore(store: string): Promise<void> {
  await idb.clear(store);
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const rec = await idb.get<{ key: string; value: T }>(idb.stores.kv, key);
    return rec && typeof rec === 'object' && 'value' in rec ? rec.value : fallback;
  } catch {
    return fallback;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await idb.put(idb.stores.kv, { key, value });
}

/** Human-readable storage usage of the origin (includes IDB blobs). */
export async function storageUsage(): Promise<{ usage: number; quota: number }> {
  try {
    const est = await navigator.storage?.estimate?.();
    return { usage: est?.usage ?? 0, quota: est?.quota ?? 0 };
  } catch {
    return { usage: 0, quota: 0 };
  }
}

export function describeUsage(usage: number, quota: number): string {
  if (quota > 0) return `${formatBytes(usage)} of ${formatBytes(quota)}`;
  return formatBytes(usage);
}

/** Nuke every local store (used by Settings → clear data). */
export async function wipeAllData(): Promise<void> {
  await Promise.all([clearStore(idb.stores.projects), clearStore(idb.stores.media), clearStore(idb.stores.kv)]);
}
