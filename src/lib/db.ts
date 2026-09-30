import { APP } from '@/config/defaults';

/**
 * Tiny promise wrapper over IndexedDB with three stores:
 *  - projects: serializable project manifests
 *  - media:    asset records including Blob file data
 *  - kv:       miscellaneous key/value state (settings, flags)
 */

const STORE_PROJECTS = 'projects';
const STORE_MEDIA = 'media';
const STORE_KV = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(APP.db, APP.dbVersion);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      req.result.onclose = () => {
        dbPromise = null;
      };
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  get: <T>(store: string, key: IDBValidKey): Promise<T | undefined> => tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  getAll: <T>(store: string): Promise<T[]> => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  put: <T>(store: string, value: T): Promise<IDBValidKey> => tx(store, 'readwrite', (s) => s.put(value as unknown as never)),
  del: (store: string, key: IDBValidKey): Promise<undefined> => tx(store, 'readwrite', (s) => s.delete(key)).then(() => undefined),
  clear: (store: string): Promise<undefined> => tx(store, 'readwrite', (s) => s.clear()).then(() => undefined),
  stores: { projects: STORE_PROJECTS, media: STORE_MEDIA, kv: STORE_KV },
};

/** localStorage-backed KV fallback for tiny settings (synchronous, pre-DB). */
export const localKv = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — non fatal */
    }
  },
};
