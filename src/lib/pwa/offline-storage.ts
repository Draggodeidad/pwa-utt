/** Generic persistence port implemented with IndexedDB in a client-only adapter. */
export interface OfflineStorage {
  get<T>(store: string, id: string): Promise<T | null>;
  put<T>(store: string, value: T): Promise<void>;
  delete(store: string, id: string): Promise<void>;
}
