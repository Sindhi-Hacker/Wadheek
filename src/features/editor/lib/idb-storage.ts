import { STORAGE_KEYS } from "@/config/defaults";
import type { Project, ProjectSummary } from "../types/project";
import type { MediaAsset } from "../types/media";

const DB_NAME = "wadheek";
const STORE_NAME = "kv";

/** In-memory fallback if IndexedDB is blocked, unsupported, or unavailable (e.g. strict private mode). */
const memoryFallback = new Map<string, unknown>();

function promisifyRequest<T = unknown>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB request failed"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

async function openAndValidateDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment");
  }

  const openReq = (version?: number) => {
    return new Promise<{ db: IDBDatabase; upgraded: boolean }>((resolve, reject) => {
      const request = version !== undefined ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
      let upgraded = false;

      request.onupgradeneeded = () => {
        upgraded = true;
        const db = request.result;
        if (db.objectStoreNames.contains(STORE_NAME)) {
          try {
            db.deleteObjectStore(STORE_NAME);
          } catch {
            /* ignore */
          }
        }
        // Create store with out-of-line keys (keyPath: null) for standard key-value storage
        db.createObjectStore(STORE_NAME);
      };

      request.onsuccess = () => resolve({ db: request.result, upgraded });
      request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
      request.onblocked = () => {
        console.warn("[idb-storage] Database upgrade blocked by another open tab/connection");
      };
    });
  };

  // Open without version to inspect current version and schema
  let { db, upgraded } = await openReq();

  db.onversionchange = () => {
    db.close();
    dbPromise = null;
  };
  db.onclose = () => {
    dbPromise = null;
  };

  if (upgraded) {
    return db;
  }

  // Check if store exists and has out-of-line keys
  let needsRecreate = false;
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    needsRecreate = true;
  } else {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      // If store uses in-line keys (keyPath !== null), it's incompatible with key-value store.
      if (store.keyPath !== null) {
        needsRecreate = true;
      }
    } catch {
      needsRecreate = true;
    }
  }

  if (needsRecreate) {
    const nextVersion = (db.version || 1) + 1;
    db.close();
    const upgradeResult = await openReq(nextVersion);
    db = upgradeResult.db;
    db.onversionchange = () => {
      db.close();
      dbPromise = null;
    };
    db.onclose = () => {
      dbPromise = null;
    };
  }

  return db;
}

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = openAndValidateDB().catch((err) => {
    dbPromise = null;
    throw err;
  });

  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await getDB();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, mode);
    } catch {
      dbPromise = null;
      return getDB()
        .then((freshDb) => {
          const freshTx = freshDb.transaction(STORE_NAME, mode);
          const store = freshTx.objectStore(STORE_NAME);
          let result: T | Promise<T>;
          try {
            result = fn(store);
          } catch (e) {
            return reject(e);
          }
          if (result instanceof Promise) {
            result.then(
              (val) => {
                freshTx.oncomplete = () => resolve(val);
              },
              reject
            );
          } else {
            freshTx.oncomplete = () => resolve(result as T);
          }
          freshTx.onerror = () => reject(freshTx.error);
          freshTx.onabort = () => reject(freshTx.error);
        })
        .catch(reject);
    }

    const store = tx.objectStore(STORE_NAME);
    let result: T | Promise<T>;
    try {
      result = fn(store);
    } catch (err) {
      return reject(err);
    }

    if (result instanceof Promise) {
      result.then(
        (val) => {
          tx.oncomplete = () => resolve(val);
        },
        reject
      );
    } else {
      tx.oncomplete = () => resolve(result as T);
    }

    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const idb = {
  get: async <T>(key: string): Promise<T | undefined> => {
    try {
      const val = await withStore("readonly", async (store) => {
        const req = store.get(key);
        const res = await promisifyRequest<any>(req);
        if (res && typeof res === "object" && "_wadheek_val" in res) {
          return res._wadheek_val as T;
        }
        return res as T;
      });
      if (val !== undefined) return val;
    } catch (err) {
      console.warn(`[idb-storage] get("${key}") error:`, err);
    }
    return memoryFallback.get(key) as T | undefined;
  },

  set: async (key: string, value: unknown): Promise<void> => {
    memoryFallback.set(key, value);
    try {
      await withStore("readwrite", (store) => {
        if (store.keyPath !== null) {
          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            !(value instanceof Blob) &&
            !ArrayBuffer.isView(value)
          ) {
            (value as any)[store.keyPath as string] = key;
            store.put(value);
          } else {
            store.put({ [store.keyPath as string]: key, _wadheek_val: value });
          }
        } else {
          store.put(value, key);
        }
      });
    } catch (err) {
      console.warn(`[idb-storage] set("${key}") error:`, err);
    }
  },

  del: async (key: string): Promise<void> => {
    memoryFallback.delete(key);
    try {
      await withStore("readwrite", (store) => {
        store.delete(key);
      });
    } catch (err) {
      console.warn(`[idb-storage] del("${key}") error:`, err);
    }
  },

  keys: async (): Promise<string[]> => {
    try {
      const idbKeys = await withStore("readonly", (store) => {
        if (typeof store.getAllKeys === "function") {
          return promisifyRequest<IDBValidKey[]>(store.getAllKeys()).then((k) =>
            k.map((item) => String(item))
          );
        }
        return new Promise<string[]>((resolve, reject) => {
          const result: string[] = [];
          const req = store.openKeyCursor ? store.openKeyCursor() : store.openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              result.push(String(cursor.key));
              cursor.continue();
            } else {
              resolve(result);
            }
          };
          req.onerror = () => reject(req.error);
        });
      });
      const all = new Set([...idbKeys, ...memoryFallback.keys()]);
      return Array.from(all);
    } catch (err) {
      console.warn("[idb-storage] keys() error:", err);
      return Array.from(memoryFallback.keys());
    }
  },

  clear: async (): Promise<void> => {
    memoryFallback.clear();
    try {
      await withStore("readwrite", (store) => {
        store.clear();
      });
    } catch (err) {
      console.warn("[idb-storage] clear() error:", err);
    }
  },
};

/* ---------------- projects ---------------- */

export async function loadProjectIndex(): Promise<ProjectSummary[]> {
  return (await idb.get<ProjectSummary[]>(STORAGE_KEYS.projectsIndex)) ?? [];
}

export async function saveProjectIndex(index: ProjectSummary[]): Promise<void> {
  await idb.set(STORAGE_KEYS.projectsIndex, index);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return idb.get<Project>(STORAGE_KEYS.project(id));
}

export async function saveProject(project: Project): Promise<void> {
  await idb.set(STORAGE_KEYS.project(project.id), project);
}

export async function deleteProjectDoc(id: string): Promise<void> {
  await idb.del(STORAGE_KEYS.project(id));
}

/* ---------------- media metadata ---------------- */

export async function loadMediaIndex(): Promise<MediaAsset[]> {
  return (await idb.get<MediaAsset[]>(STORAGE_KEYS.media)) ?? [];
}

export async function saveMediaIndex(index: MediaAsset[]): Promise<void> {
  await idb.set(STORAGE_KEYS.media, index);
}

/* ---------------- derived data ---------------- */

export async function saveWaveform(mediaId: string, peaks: Float32Array): Promise<void> {
  await idb.set(STORAGE_KEYS.waveform(mediaId), peaks);
}

export async function loadWaveform(mediaId: string): Promise<Float32Array | undefined> {
  return idb.get<Float32Array>(STORAGE_KEYS.waveform(mediaId));
}

export async function saveThumbnails(mediaId: string, thumbs: Blob[]): Promise<void> {
  await idb.set(STORAGE_KEYS.thumbs(mediaId), thumbs);
}

export async function loadThumbnails(mediaId: string): Promise<Blob[] | undefined> {
  return idb.get<Blob[]>(STORAGE_KEYS.thumbs(mediaId));
}

export async function deleteDerived(mediaId: string): Promise<void> {
  await Promise.all([
    idb.del(STORAGE_KEYS.waveform(mediaId)),
    idb.del(STORAGE_KEYS.thumbs(mediaId)),
  ]);
}

/* ---------------- session ---------------- */

export async function saveLastSession(projectId: string | null): Promise<void> {
  await idb.set(STORAGE_KEYS.lastSession, projectId);
}

export async function loadLastSession(): Promise<string | null> {
  return (await idb.get<string | null>(STORAGE_KEYS.lastSession)) ?? null;
}

/** Wipe every Wadheek key (used by Settings > Clear all data). */
export async function clearAllIdb(): Promise<void> {
  await idb.clear();
}
