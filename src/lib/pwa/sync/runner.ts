import type { LocalPhoto } from "../../../features/findings/photo-contracts.ts";
import { ApiClientError } from "../../api/client.ts";
import type { ApiClient } from "../../api/client.ts";
import type { DomainOperation, DomainOperationError, OperationAcknowledgement, SyncQueueItem } from "../../../features/sync/types.ts";
import type { Uuid } from "../../../types/entity.ts";
import { LeaseLostError } from "../offline-storage.ts";
import type { LocalStorage } from "../offline-storage.ts";
import { inspectConflict } from "../../../features/sync/services/conflict-detection.ts";

export type QueueTransport = {
  client: ApiClient;
  /** Must verify the server session, not only the remembered offline identity. */
  verifyOwner(owner: Uuid): Promise<boolean>;
  sendPhoto?: (item: SyncQueueItem, photo: LocalPhoto | null) => Promise<OperationAcknowledgement>;
  now?: () => number;
  shouldContinue?: () => boolean;
  /** Optional observer of persisted ACKs. Its errors cannot change transport results. */
  onAcknowledged?: (operationId: Uuid) => void | Promise<void>;
};

const MAX_ATTEMPTS = 5;
const LEASE_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_RETRY_AFTER_MS = 86_400_000;

function isTransient(error: unknown): boolean {
  return !(error instanceof ApiClientError) || [408, 429].includes(error.status) || error.status >= 500;
}

function retryDelay(error: unknown, attempt: number): number | null {
  if (!isTransient(error)) return null;
  if (attempt >= MAX_ATTEMPTS) return null;
  const backoff = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempt - 1));
  const requested = error instanceof ApiClientError ? error.retryAfterMs ?? 0 : 0;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(backoff, requested));
}

export function operationRoute(kind: DomainOperation["kind"], entityId: Uuid): { method: "post" | "put" | "patch" | "delete"; path: string } {
  const inspection = `/api/inspections/${entityId}`;
  const finding = `/api/findings/${entityId}`;
  switch (kind) {
    case "inspection.create": return { method: "put", path: inspection };
    case "inspection.update": return { method: "patch", path: inspection };
    case "inspection.discard": return { method: "delete", path: inspection };
    case "inspection.finalize": return { method: "post", path: `${inspection}/finalize` };
    case "finding.create": return { method: "put", path: finding };
    case "finding.update": return { method: "patch", path: finding };
    case "finding.delete": return { method: "delete", path: finding };
    case "finding.followup": return { method: "patch", path: `${finding}/follow-up` };
    case "photo.upload": return { method: "put", path: `/api/photos/${entityId}` };
    case "photo.delete": return { method: "delete", path: `/api/photos/${entityId}` };
  }
}

export async function sendOperation(client: ApiClient, item: SyncQueueItem): Promise<OperationAcknowledgement> {
  if (!item.frozenRequest) throw new Error("La petición debe congelarse antes del envío");
  const { method, path } = operationRoute(item.frozenRequest.kind, item.entityId);
  const options = { operationId: item.operationId };
  if (method === "delete") return client.delete<OperationAcknowledgement>(path, { ...options, body: item.frozenRequest });
  return client[method]<OperationAcknowledgement, DomainOperation>(path, item.frozenRequest, options);
}

function transportError(error: unknown): DomainOperationError {
  return error instanceof ApiClientError
    ? { code: error.payload.code, message: error.payload.message, ...(error.payload.fieldErrors ? { fieldErrors: error.payload.fieldErrors } : {}) }
    : { code: "UNAVAILABLE", message: "Servicio no disponible" };
}

/** One active run for one verified owner. An errored item blocks only its own dependents. */
export async function runQueue(storage: LocalStorage, owner: Uuid, transport: QueueTransport): Promise<{ acknowledged: number; failed: number; paused: boolean }> {
  let acknowledged = 0;
  let failed = 0;
  const attempted = new Set<string>();
  if (!await transport.verifyOwner(owner)) return { acknowledged, failed, paused: true };
  const now = transport.now ?? Date.now;
  const token = await storage.acquireLease(owner, now(), LEASE_MS);
  if (!token) return { acknowledged, failed, paused: true };
  const heartbeat = setInterval(() => { void storage.renewLease(owner, token, now(), LEASE_MS).catch(() => {}); }, LEASE_MS / 3);
  try {
  const clientId = await storage.getClientId();

  while (true) {
    if (transport.shouldContinue?.() === false) return { acknowledged, failed, paused: true };
    const queue = await storage.listQueue(owner);
    const live = new Set(queue.map((item) => item.operationId));
    let ready: SyncQueueItem | undefined;
    for (const item of queue) {
      if (attempted.has(item.operationId) || item.ownerUserId !== owner || item.dependsOn.some((id) => live.has(id))) continue;
      if (item.status === "error" && !item.nextAttemptAt) continue;
      if (item.nextAttemptAt && Date.parse(item.nextAttemptAt) > now()) continue;
      if (queue.some((other) => other.entityId === item.entityId && other.localOrder < item.localOrder)) continue;
      if (item.entity === "photo") {
        const photo = await storage.getPhoto(owner, item.entityId);
        const findingId = photo?.findingId ?? (item.payload as { findingId?: string }).findingId;
        const finding = findingId ? await storage.getFinding(owner, findingId) : null;
        const parent = item.parentEntityId ? await storage.getInspection(owner, item.parentEntityId) : null;
        if (finding?.baseVersion === null || parent?.baseVersion === null) continue;
      }
      if (item.operation === "finding.delete" || item.operation === "inspection.discard") {
        const photos = await storage.listPhotos(owner, item.parentEntityId ?? item.entityId);
        if (photos.some(photo => item.operation === "inspection.discard" || photo.findingId === item.entityId)) continue;
      }
      if (item.entity === "finding") {
        const finding = await storage.getFinding(owner, item.entityId);
        const parentId = finding?.inspectionId ?? item.parentEntityId;
        const parent = parentId ? await storage.getInspection(owner, parentId) : null;
        if (parent && parent.baseVersion === null) continue;
        if (!parent && queue.some((other) => other.entityId === parentId)) continue;
      }
      if (item.operation === "inspection.finalize") {
        const photos = await storage.listPhotos(owner, item.entityId);
        if (photos.some(photo => photo.status !== "uploaded" || photo.deletedAt)) continue;
        const findings = await storage.listFindings(owner, item.entityId);
        if (queue.some((other) => other.operationId !== item.operationId && (
          other.entityId === item.entityId || other.parentEntityId === item.entityId || findings.some((finding) => finding.id === other.entityId)
        ))) continue;
      }
      ready = item;
      break;
    }
    if (!ready) break;
    attempted.add(ready.operationId);
    if (!await transport.verifyOwner(owner)) return { acknowledged, failed, paused: true };
    if (transport.shouldContinue?.() === false) return { acknowledged, failed, paused: true };
    await storage.renewLease(owner, token, now(), LEASE_MS);
    if (transport.shouldContinue?.() === false) return { acknowledged, failed, paused: true };
    const sent = await storage.prepareSend(owner, ready.operationId, clientId, token, now());
    if (!sent) continue;
    try {
      const ack = sent.entity === "photo"
        ? await (transport.sendPhoto ? transport.sendPhoto(sent, await storage.getPhoto(owner, sent.entityId)) : Promise.reject(new Error("photo transport unavailable")))
        : await sendOperation(transport.client, sent);
      if (!await transport.verifyOwner(owner)) return { acknowledged, failed, paused: true };
      await storage.renewLease(owner, token, now(), LEASE_MS);
      await storage.acknowledge(owner, sent, ack, token, now());
      acknowledged++;
      try { await transport.onAcknowledged?.(sent.operationId); } catch { /* ACK is already durable. */ }
    } catch (error) {
      if (error instanceof LeaseLostError) return { acknowledged, failed, paused: true };
      const conflict = await inspectConflict(transport.client, sent, error);
      if (!await transport.verifyOwner(owner)) return { acknowledged, failed, paused: true };
      const delay = retryDelay(error, sent.attempts);
      const nextAttemptAt = delay === null ? null : new Date(now() + delay).toISOString();
      await storage.failSend(owner, sent, transportError(error), nextAttemptAt, token, now(), isTransient(error) && sent.attempts >= MAX_ATTEMPTS, conflict ?? undefined);
      failed++;
      if (error instanceof ApiClientError && error.status === 401) return { acknowledged, failed, paused: true };
    }
  }
  return { acknowledged, failed, paused: false };
  } catch (error) {
    if (error instanceof LeaseLostError) return { acknowledged, failed, paused: true };
    throw error;
  } finally {
    clearInterval(heartbeat);
    await storage.releaseLease(owner, token);
  }
}
