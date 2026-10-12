export const LOCAL_DB_NAME = "pwa-utt-local";
export const LOCAL_DB_VERSION = 3;

export type IndexedDbStoreSpec = {
  name: string;
  keyPath: string;
  indexes?: readonly { name: string; keyPath: string }[];
};

/** Initial, forward-compatible local schema. New stores/indexes are additive. */
export const localStoreSpecs: readonly IndexedDbStoreSpec[] = [
  { name: "inspection_local", keyPath: "id", indexes: [{ name: "owner", keyPath: "ownerUserId" }] },
  { name: "finding_local", keyPath: "id", indexes: [{ name: "owner", keyPath: "ownerUserId" }, { name: "inspection", keyPath: "inspectionId" }] },
  { name: "sync_queue", keyPath: "operationId", indexes: [{ name: "owner", keyPath: "ownerUserId" }, { name: "entity", keyPath: "entityId" }] },
  { name: "catalog_local", keyPath: "id", indexes: [{ name: "owner", keyPath: "ownerUserId" }] },
  { name: "conflict_local", keyPath: "operationId", indexes: [{ name: "owner", keyPath: "ownerUserId" }] },
  { name: "photo_local", keyPath: "id", indexes: [{ name: "owner", keyPath: "ownerUserId" }, { name: "inspection", keyPath: "inspectionId" }, { name: "finding", keyPath: "findingId" }] },
  { name: "metadata", keyPath: "name" },
];

export class StorageOpenError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageOpenError";
    this.cause = cause;
  }
}

export class StorageWriteError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageWriteError";
    this.cause = cause;
  }
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Opens the local database, creating the initial schema on first run. */
export function openLocalDatabase(databaseName = LOCAL_DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new StorageOpenError("IndexedDB no está disponible"));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(databaseName, LOCAL_DB_VERSION);
    } catch (error) {
      reject(new StorageOpenError("No se pudo abrir la base de datos local", error));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const spec of localStoreSpecs) {
        if (db.objectStoreNames.contains(spec.name)) continue;
        const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath });
        for (const index of spec.indexes ?? []) store.createIndex(index.name, index.keyPath);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(new StorageOpenError(request.error?.message ?? "No se pudo abrir la base de datos local", request.error));
    };
  });
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Runs `work` inside one IndexedDB transaction and resolves only after the
 * transaction commits; an error inside the transaction aborts it (rolling back
 * every prior write in that transaction) and rejects.
 */
export function runTransaction<T>(
  db: IDBDatabase,
  storeNames: readonly string[],
  mode: IDBTransactionMode,
  work: (stores: Record<string, IDBObjectStore>) => Promise<T> | T
): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction([...storeNames], mode);
    } catch (error) {
      reject(new StorageWriteError("No se pudo iniciar la transacción local", error));
      return;
    }
    const stores: Record<string, IDBObjectStore> = {};
    for (const name of storeNames) stores[name] = tx.objectStore(name);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = (event) => {
      event.preventDefault();
      reject(new StorageWriteError(tx.error?.message ?? "La transacción local falló", tx.error));
    };
    tx.onabort = () => {
      reject(new StorageWriteError(tx.error?.message ?? "La transacción local fue cancelada", tx.error));
    };
    Promise.resolve(work(stores)).then(
      (value) => { result = value; },
      (error) => {
        reject(error);
        try { tx.abort(); } catch { /* transaction already aborted */ }
      }
    );
  });
}
