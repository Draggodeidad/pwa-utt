// W05 contract path: the app keeps one IndexedDB schema and migration path.
export {
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  localStoreSpecs,
  openLocalDatabase,
  requestToPromise,
  runTransaction,
  StorageOpenError,
  StorageWriteError,
  isIndexedDbAvailable,
} from "../pwa/indexed-db.ts";
export type { IndexedDbStoreSpec } from "../pwa/indexed-db.ts";
