/** Transport boundary. A concrete backend client is intentionally deferred. */
export interface ApiClient {
  get<T>(path: string): Promise<T>;
  put<T>(path: string, body: T): Promise<T>;
}
