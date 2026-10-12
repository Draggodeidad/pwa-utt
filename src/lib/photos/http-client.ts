import { ApiClientError } from "../api/client.ts";
import type { LocalPhoto } from "../../features/findings/photo-contracts.ts";
import type { SyncQueueItem, OperationAcknowledgement, DomainOperationError } from "../../features/sync/types.ts";
export async function sendPhotoOperation(item: SyncQueueItem, photo: LocalPhoto | null, fetchImpl: typeof fetch = globalThis.fetch): Promise<OperationAcknowledgement> {
  if (!item.frozenRequest) throw new Error("photo request not frozen");
  const upload = item.operation === "photo.upload";
  if (upload && !photo?.blob) throw new Error("photo blob unavailable");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetchImpl(`/api/photos/${item.entityId}`, {
      method: upload ? "PUT" : "DELETE", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: { "idempotency-key": item.operationId, "content-type": upload ? photo!.mimeType : "application/json", ...(upload ? { "x-photo-operation": JSON.stringify(item.frozenRequest) } : {}) },
      body: upload ? photo!.blob : JSON.stringify(item.frozenRequest),
    });
    const body = await response.json();
    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - Date.now() : NaN;
      throw new ApiClientError(response.status, { code: body.code ?? "UNAVAILABLE", message: body.error ?? "No se pudo sincronizar la foto" } as DomainOperationError, Number.isFinite(delay) ? Math.max(0, delay) : null);
    }
    return body as OperationAcknowledgement;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    throw new ApiClientError(503, { code: "UNAVAILABLE", message: "No se pudo sincronizar la foto" });
  } finally { clearTimeout(timeout); }
}
