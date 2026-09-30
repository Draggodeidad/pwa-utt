// In-memory IndexedDB harness used by the local-storage spec. It implements the
// subset of the IndexedDB API the local adapter uses (open/upgrade, object
// stores with simple keyPath, indexes by equality, readwrite transactions with
// atomic commit/rollback) and lets tests inject put failures (quota/errors).
// Plain CommonJS so Node can require it directly.
"use strict";

function createIndexedDbHarness() {
  const databases = new Map();
  let pendingPutError = null;

  function makeRequest() {
    return { onsuccess: null, onerror: null, result: undefined, error: null };
  }

  function fire(request, error) {
    queueMicrotask(() => {
      if (error) {
        request.error = error;
        if (request.onerror) request.onerror({ preventDefault() {} });
      } else if (request.onsuccess) {
        request.onsuccess({});
      }
    });
  }

  function clone(value) {
    return value === undefined ? value : structuredClone(value);
  }

  function cloneMap(source) {
    const copy = new Map();
    for (const [key, value] of source) copy.set(key, clone(value));
    return copy;
  }

  function fireAsynchronously(request, error) {
    queueMicrotask(() => fire(request, error));
  }

  function makeIndex(storeState, spec) {
    return {
      name: spec.name,
      keyPath: spec.keyPath,
      getAll(query) {
        const request = makeRequest();
        const rows = [];
        for (const [, value] of storeState) {
          if (query === undefined || value[spec.keyPath] === query) rows.push(clone(value));
        }
        request.result = rows;
        fire(request, null);
        return request;
      },
      getAllKeys(query) {
        const request = makeRequest();
        const keys = [];
        for (const [key, value] of storeState) {
          if (query === undefined || value[spec.keyPath] === query) keys.push(key);
        }
        request.result = keys;
        fire(request, null);
        return request;
      },
      get(query) {
        const request = makeRequest();
        for (const [, value] of storeState) {
          if (query === undefined || value[spec.keyPath] === query) {
            request.result = clone(value);
            fire(request, null);
            return request;
          }
        }
        request.result = undefined;
        fire(request, null);
        return request;
      },
    };
  }

  function makeObjectStore(storeState, spec, tx) {
    return {
      name: spec.name,
      keyPath: spec.keyPath,
      get(key) {
        const request = makeRequest();
        request.result = storeState.has(key) ? clone(storeState.get(key)) : undefined;
        fire(request, null);
        return request;
      },
      put(value) {
        const request = makeRequest();
        if (pendingPutError && pendingPutError.storeName === spec.name) {
          const failure = pendingPutError;
          pendingPutError = null;
          request.error = failure.error;
          fire(request, failure.error);
          if (tx) tx.abortWithError(failure.error);
          return request;
        }
        const key = value[spec.keyPath];
        storeState.set(key, clone(value));
        request.result = key;
        fire(request, null);
        return request;
      },
      delete(key) {
        const request = makeRequest();
        storeState.delete(key);
        request.result = undefined;
        fire(request, null);
        return request;
      },
      clear() {
        const request = makeRequest();
        storeState.clear();
        fire(request, null);
        return request;
      },
      count() {
        const request = makeRequest();
        request.result = storeState.size;
        fire(request, null);
        return request;
      },
      createIndex(name, keyPath) {
        spec.indexes.push({ name, keyPath });
        return makeIndex(storeState, { name, keyPath });
      },
      index(name) {
        const indexSpec = spec.indexes.find((entry) => entry.name === name);
        if (!indexSpec) throw new Error(`Index ${name} not found on ${spec.name}`);
        return makeIndex(storeState, indexSpec);
      },
    };
  }

  function makeTransaction(dbState, storeNames, mode) {
    const snapshots = new Map();
    for (const name of storeNames) snapshots.set(name, cloneMap(dbState.stores.get(name)));
    let aborted = false;
    const tx = {
      mode,
      error: null,
      oncomplete: null,
      onabort: null,
      onerror: null,
      objectStore(name) {
        if (!dbState.stores.has(name)) throw new Error(`Store ${name} not found`);
        return makeObjectStore(dbState.stores.get(name), dbState.specs.get(name), tx);
      },
      abort() {
        tx.abortWithError(new Error("Transaction aborted"));
      },
      abortWithError(error) {
        if (aborted) return;
        aborted = true;
        tx.error = error;
        for (const [name, snapshot] of snapshots) dbState.stores.set(name, cloneMap(snapshot));
        if (tx.onabort) tx.onabort({ preventDefault() {} });
      },
      _complete() {
        if (aborted) return;
        if (tx.oncomplete) tx.oncomplete({});
      },
    };
    setTimeout(() => tx._complete(), 0);
    return tx;
  }

  function makeDatabase(name, dbState) {
    return {
      name,
      version: dbState.version,
      objectStoreNames: {
        contains(storeName) {
          return dbState.specs.has(storeName);
        },
      },
      transaction(storeNames, mode) {
        return makeTransaction(dbState, Array.isArray(storeNames) ? storeNames : [storeNames], mode);
      },
      close() {},
      _upgrading: dbState.upgrading,
      createObjectStore(storeName, options) {
        if (!dbState.upgrading) throw new Error("createObjectStore is only allowed during an upgrade");
        const spec = { name: storeName, keyPath: options.keyPath, indexes: [] };
        dbState.specs.set(storeName, spec);
        dbState.stores.set(storeName, new Map());
        return makeObjectStore(dbState.stores.get(storeName), spec, null);
      },
    };
  }

  function openDatabase(name, version) {
    const request = makeRequest();
    let dbState = databases.get(name);
    if (!dbState) {
      dbState = { version: 0, stores: new Map(), specs: new Map(), upgrading: false };
      databases.set(name, dbState);
    }
    if (version < dbState.version) {
      request.error = new Error(`VersionError: the requested version (${version}) is less than the existing version (${dbState.version})`);
      fireAsynchronously(request, request.error);
      return request;
    }
    if (version > dbState.version) {
      const oldVersion = dbState.version;
      dbState.version = version;
      dbState.upgrading = true;
      const db = makeDatabase(name, dbState);
      request.result = db;
      queueMicrotask(() => {
        if (request.onupgradeneeded) request.onupgradeneeded({ oldVersion });
        dbState.upgrading = false;
        fire(request, null);
      });
      return request;
    }
    const db = makeDatabase(name, dbState);
    request.result = db;
    fireAsynchronously(request, null);
    return request;
  }

  return {
    indexedDB: { open: openDatabase },
    failNextPut(storeName, error) {
      pendingPutError = { storeName, error };
    },
  };
}

module.exports = { createIndexedDbHarness };