"use client";

// Blob's copy of your data on this device: one IndexedDB database per account ("blob:<user id>").
// Every function here quietly does nothing where IndexedDB isn't available (server rendering, some
// private windows): the app then simply works online only.

const VERSION = 1;

/** The stores. Rows are keyed by `id`; the outbox by `key` (sortable: the order writes were made). */
export const STORES = ["events", "tasks", "pages", "subjects", "notes", "outbox", "meta"] as const;
export type StoreName = (typeof STORES)[number];

const KEY_PATH: Record<StoreName, string> = {
  events: "id",
  tasks: "id",
  pages: "id",
  subjects: "id",
  notes: "id",
  outbox: "key",
  meta: "key",
};

const opened = new Map<string, Promise<IDBDatabase | null>>();

export const dbName = (userId: string) => `blob:${userId}`;

function promise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** The account's database, or null without IndexedDB. Opened once per page. */
export function openDb(userId: string): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined" || !userId) return Promise.resolve(null);
  let db = opened.get(userId);
  if (!db) {
    db = new Promise<IDBDatabase | null>((resolve) => {
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(dbName(userId), VERSION);
      } catch {
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const name of STORES) {
          if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: KEY_PATH[name] });
        }
      };
      req.onsuccess = () => {
        const d = req.result;
        // Another tab wants a newer version (a later release): let it, this tab reloads its data then.
        d.onversionchange = () => {
          d.close();
          opened.delete(userId);
        };
        resolve(d);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    opened.set(userId, db);
  }
  return db;
}

export async function getAll<T>(userId: string, store: StoreName): Promise<T[]> {
  const db = await openDb(userId);
  if (!db) return [];
  try {
    return (await promise(db.transaction(store).objectStore(store).getAll())) as T[];
  } catch {
    return [];
  }
}

export async function getOne<T>(userId: string, store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb(userId);
  if (!db) return undefined;
  try {
    return (await promise(db.transaction(store).objectStore(store).get(key))) as T | undefined;
  } catch {
    return undefined;
  }
}

/** Writes and deletes in one transaction. */
export async function write(userId: string, store: StoreName, puts: unknown[], deletes: string[] = []): Promise<boolean> {
  if (!puts.length && !deletes.length) return true;
  const db = await openDb(userId);
  if (!db) return false;
  try {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const value of puts) os.put(value);
    for (const key of deletes) os.delete(key);
    await done(tx);
    return true;
  } catch {
    return false;
  }
}

/** Replaces everything in `store` with `values`. */
export async function replaceAll(userId: string, store: StoreName, values: unknown[]): Promise<boolean> {
  const db = await openDb(userId);
  if (!db) return false;
  try {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    os.clear();
    for (const value of values) os.put(value);
    await done(tx);
    return true;
  } catch {
    return false;
  }
}

export async function getMeta<T>(userId: string, key: string): Promise<T | undefined> {
  return (await getOne<{ key: string; value: T }>(userId, "meta", key))?.value;
}

export function setMeta(userId: string, key: string, value: unknown) {
  return write(userId, "meta", [{ key, value }]);
}

/** Removes the account's data from this device (sign-out). */
export async function wipeDb(userId: string): Promise<void> {
  if (typeof indexedDB === "undefined" || !userId) return;
  const db = await opened.get(userId);
  db?.close();
  opened.delete(userId);
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(dbName(userId));
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Removes every Blob database on this device (signing out without knowing whose data is here), or
 * every one but `keep`'s (another account signed in on this device).
 */
export async function wipeAllDbs(keep?: string): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return;
  // Open connections would hold the deletion back until the page closes.
  for (const [id, db] of opened) {
    if (id === keep) continue;
    (await db)?.close();
    opened.delete(id);
  }
  try {
    const list = await indexedDB.databases();
    await Promise.all(
      list
        .filter((d) => d.name?.startsWith("blob:") && (!keep || d.name !== dbName(keep)))
        .map(
          (d) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(d.name!);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            }),
        ),
    );
  } catch {
    // Nothing to remove.
  }
}
