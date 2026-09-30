import { ApiClientError } from "./client.ts";
import type { ApiClient } from "./client.ts";
import type { DomainOperationError } from "@/features/sync";

export type HttpClientOptions = {
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
  timeoutMs?: number;
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
  private readonly timeoutMs: number;

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.baseHeaders = { "content-type": "application/json", ...options.headers };
    this.timeoutMs = options.timeoutMs ?? 15_000;
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      response = await this.fetchImpl(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "same-origin",
        ...(method === "GET" ? { cache: "no-store" as const } : {}),
        signal: controller.signal,
      });
    } catch {
      throw new ApiClientError(503, { code: "UNAVAILABLE", message: "Servicio no disponible" });
    } finally {
      clearTimeout(timeout);
    }

    let payload: unknown = null;
    if (response.status !== 204) {
      try { payload = await response.json(); } catch { payload = null; }
    }
    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
      throw new ApiClientError(response.status, toDomainError(payload), Number.isFinite(delay) ? Math.max(0, delay) : null);
    }
    return payload as TResponse;
  }
}
