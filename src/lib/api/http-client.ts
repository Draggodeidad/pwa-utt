import { ApiClientError } from "./client";
import type { ApiClient } from "./client";
import type { DomainOperationError } from "@/features/sync";

export type HttpClientOptions = {
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
};

type WireError = {
  code?: string;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  localSnapshot?: unknown;
  remoteSnapshot?: unknown;
};

function toDomainError(body: unknown): DomainOperationError {
  const wire = (typeof body === "object" && body !== null ? body : {}) as WireError;
  return {
    code: (wire.code as DomainOperationError["code"]) ?? "UNAVAILABLE",
    message: wire.message ?? wire.error ?? "Servicio no disponible",
    ...(wire.fieldErrors ? { fieldErrors: wire.fieldErrors } : {}),
    ...(wire.localSnapshot !== undefined ? { localSnapshot: wire.localSnapshot } : {}),
    ...(wire.remoteSnapshot !== undefined ? { remoteSnapshot: wire.remoteSnapshot } : {}),
  };
}

/** Concrete browser transport for the queue and remote repositories. */
export class HttpClient implements ApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseHeaders: Record<string, string>;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.baseHeaders = { "content-type": "application/json", ...options.headers };
  }

  async get<T>(path: string): Promise<T> {
    return this.send<T>("GET", path);
  }

  async post<TResponse, TBody>(path: string, body: TBody, options?: { operationId?: string }): Promise<TResponse> {
    return this.send<TResponse>("POST", path, body, options);
  }

  async put<TResponse, TBody>(path: string, body: TBody, options?: { operationId?: string }): Promise<TResponse> {
    return this.send<TResponse>("PUT", path, body, options);
  }

  async patch<TResponse, TBody>(path: string, body: TBody, options?: { operationId?: string }): Promise<TResponse> {
    return this.send<TResponse>("PATCH", path, body, options);
  }

  async delete<TResponse>(path: string, options: { operationId: string; body?: unknown }): Promise<TResponse> {
    return this.send<TResponse>("DELETE", path, options.body, options);
  }

  private async send<TResponse>(
    method: string,
    path: string,
    body?: unknown,
    options?: { operationId?: string }
  ): Promise<TResponse> {
    const headers: Record<string, string> = { ...this.baseHeaders };
    if (options?.operationId) headers["idempotency-key"] = options.operationId;

    let response: Response;
    try {
      response = await this.fetchImpl(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "same-origin",
      });
    } catch {
      throw new ApiClientError(503, { code: "UNAVAILABLE", message: "Servicio no disponible" });
    }

    let payload: unknown = null;
    if (response.status !== 204) {
      try { payload = await response.json(); } catch { payload = null; }
    }
    if (!response.ok) {
      throw new ApiClientError(response.status, toDomainError(payload));
    }
    return payload as TResponse;
  }
}