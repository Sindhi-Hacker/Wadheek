import { STORAGE_KEYS } from "@/config/defaults";
import { idb } from "./idb-storage";

/**
 * Large binary blobs (imported media, render outputs) are stored in the
 * Origin Private File System when available, falling back to IndexedDB.
 */

const DIR = "wadheek-media";

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!("storage" in navigator) || !navigator.storage.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(DIR, { create: true });
  } catch {
    return null;
  }
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  const dir = await opfsRoot();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(id, { create: true });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch {
      /* fall through to IDB */
    }
  }
  await idb.set(STORAGE_KEYS.mediaBlob(id), blob);
}

export async function loadBlob(id: string): Promise<Blob | undefined> {
  const dir = await opfsRoot();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(id);
      return await handle.getFile();
    } catch {
      /* not in OPFS — try IDB */
    }
  }
  return idb.get<Blob>(STORAGE_KEYS.mediaBlob(id));
}

export async function deleteBlob(id: string): Promise<void> {
  const dir = await opfsRoot();
  if (dir) {
    try {
      await dir.removeEntry(id);
    } catch {
      /* ignore */
    }
  }
  await idb.del(STORAGE_KEYS.mediaBlob(id));
}

export async function clearAllBlobs(): Promise<void> {
  const dir = await opfsRoot();
  if (dir) {
    try {
      // @ts-expect-error async iterator on directory handles
      for await (const name of dir.keys()) {
        await dir.removeEntry(name as string).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  }
}

export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  } catch {
    return null;
  }
}

/** Runtime object-URL cache so components never hold blobs directly. */
const urlCache = new Map<string, string>();

export async function getMediaUrl(id: string): Promise<string | undefined> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await loadBlob(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export function revokeMediaUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}
