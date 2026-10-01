import { createIntent } from "../../inspections/services/local-capture.ts";
import type { FindingDto, FindingPriority, FindingStatus, LocalFinding } from "../types.ts";
import type { LocalStorage } from "../../../lib/pwa/offline-storage.ts";
import type { SyncQueueItem } from "../../sync/types.ts";

export function validFollowup(current: FindingStatus, next: FindingStatus): boolean {
  return current === next || current === "pending" && next === "in_review" || current === "in_review" && next === "resolved";
}

export async function saveCoordinationFollowup(
  storage: LocalStorage,
  owner: string,
  remote: FindingDto,
  priority: FindingPriority,
  status: FindingStatus,
): Promise<SyncQueueItem | null> {
  if (remote.workflowStatus !== "completed") throw new Error("Solo se puede dar seguimiento a inspecciones finalizadas");
  const existing = await storage.getFinding(owner, remote.id);
  const queue = await storage.listQueue(owner);
  const preceding = queue.filter((item) => item.entityId === remote.id).at(-1);
  const localIsNewer = !!existing && (existing.version > remote.version || existing.syncStatus === "pending" || !!preceding);
  const currentPriority = localIsNewer ? existing.priority : remote.priority;
  const currentStatus = localIsNewer ? existing.status : remote.status;
  if (!validFollowup(currentStatus, status)) throw new Error("El estado solo puede avanzar un paso");
  if (currentPriority === priority && currentStatus === status) return null;
  const now = new Date().toISOString();
  const local: LocalFinding = {
    id: remote.id,
    inspectionId: remote.inspectionId,
    title: remote.title,
    description: remote.description,
    priority,
    status,
    createdBy: remote.createdBy,
    updatedBy: owner,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    version: existing?.version ?? remote.version,
    resolvedAt: status === "resolved" ? now : existing?.resolvedAt ?? remote.resolvedAt,
    deletedAt: null,
    ownerUserId: owner,
    localRevision: (existing?.localRevision ?? 0) + 1,
    baseVersion: preceding ? existing?.baseVersion ?? remote.version : Math.max(existing?.version ?? 0, remote.version),
    syncStatus: "pending",
    localUpdatedAt: now,
  };
  const payload = {
    ...(priority !== currentPriority ? { priority } : {}),
    ...(status !== currentStatus ? { status } : {}),
  };
  const intent = createIntent({
    owner,
    entity: "finding",
    entityId: remote.id,
    parentEntityId: remote.inspectionId,
    operation: "finding.followup",
    payload,
    baseVersion: local.baseVersion,
    dependsOn: preceding ? [preceding.operationId] : [],
    localOrder: Math.max(0, ...queue.map((item) => item.localOrder)) + 1,
  });
  await storage.saveDraftWithIntent(owner, { store: "finding_local", value: local }, intent);
  return intent;
}
