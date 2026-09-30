import type { DomainOperationError } from "@/features/sync/types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: DomainOperationError;

  constructor(status: number, payload: DomainOperationError) {
    super(payload.message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

/** Transport boundary. A concrete backend client is intentionally deferred. */
export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<TResponse, TBody>(path: string, body: TBody, options?: { operationId?: string }): Promise<TResponse>;
  put<TResponse, TBody>(path: string, body: TBody, options?: { operationId?: string }): Promise<TResponse>;
  patch<TResponse, TBody>(path: string, body: TBody, options?: { operationId: string }): Promise<TResponse>;
  delete<TResponse>(path: string, options?: { operationId: string; body?: unknown }): Promise<TResponse>;
}
