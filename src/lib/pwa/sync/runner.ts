import { ApiClientError } from "../../api/client.ts";
import type { ApiClient } from "../../api/client.ts";
import type { DomainOperation, DomainOperationError, OperationAcknowledgement, SyncQueueItem } from "../../../features/sync/types.ts";
import type { Uuid } from "../../../types/entity.ts";
import type { LocalStorage } from "../offline-storage.ts";

export type QueueTransport = {
  client: ApiClient;
  /** Must verify the server session, not only the remembered offline identity. */
  verifyOwner(owner: Uuid): Promise<boolean>;
};

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
    ? error.payload
    : { code: "UNAVAILABLE", message: "Servicio no disponible" };
}

/** One active run for one verified owner. An errored item blocks only its own dependents. */
export async function runQueue(storage: LocalStorage, owner: Uuid, transport: QueueTransport): Promise<{ acknowledged: number; failed: number; paused: boolean }> {
  let acknowledged = 0;
  let failed = 0;
  const attempted = new Set<string>();
  if (!await transport.verifyOwner(owner)) return { acknowledged, failed, paused: true };
  const clientId = await storage.getClientId();

  while (true) {
    const queue = await storage.listQueue(owner);
    const live = new Set(queue.map((item) => item.operationId));
    let ready: SyncQueueItem | undefined;
    for (const item of queue) {
      if (attempted.has(item.operationId) || item.ownerUserId !== owner || item.dependsOn.some((id) => live.has(id))) continue;
      if (queue.some((other) => other.entityId === item.entityId && other.localOrder < item.localOrder)) continue;
      if (item.entity === "finding") {
        const finding = await storage.getFinding(owner, item.entityId);
        const parentId = finding?.inspectionId ?? item.parentEntityId;
        const parent = parentId ? await storage.getInspection(owner, parentId) : null;
        if (parent && parent.baseVersion === null) continue;
        if (!parent && queue.some((other) => other.entityId === parentId)) continue;
      }
      if (item.operation === "inspection.finalize") {
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
    const sent = await storage.prepareSend(owner, ready.operationId, clientId);
    if (!sent) continue;
    try {
      const ack = await sendOperation(transport.client, sent);
      if (!await transport.verifyOwner(owner)) return { acknowledged, failed, paused: true };
      await storage.acknowledge(owner, sent, ack);
      acknowledged++;
    } catch (error) {
      await storage.failSend(owner, sent, transportError(error));
      failed++;
    }
  }
  return { acknowledged, failed, paused: false };
}
