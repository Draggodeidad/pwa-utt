/** Contract for future service-worker cache management. */
export interface AppCache {
  warm(urls: readonly string[]): Promise<void>;
  clearOutdated(): Promise<void>;
}
