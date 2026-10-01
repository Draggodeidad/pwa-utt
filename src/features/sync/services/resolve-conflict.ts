import type { ApiClient } from "../../../lib/api/client.ts";
import { ApiClientError } from "../../../lib/api/client.ts";
import type { LocalStorage, ConflictResolutionWrite, LocalEntityRecord } from "../../../lib/pwa/offline-storage.ts";
import type { LocalInspection, InspectionDetail } from "../../inspections/types.ts";
import type { LocalFinding, FindingDto } from "../../findings/types.ts";
import { createIntent } from "../../inspections/services/local-capture.ts";
import type { Uuid } from "../../../types/entity.ts";
import type { ConflictRecord, SyncQueueItem } from "../types.ts";
import { inspectConflict } from "./conflict-detection.ts";

export class ConflictResolutionError extends Error {}

type ResolutionContext = {
  storage: LocalStorage;
  client: ApiClient;
  owner: Uuid;
  /** Return the verified server role for this exact account, or null. */
  verifyOwner: (owner: Uuid) => Promise<"technician" | "coordinator" | null>;
};

function asRemote(conflict: ConflictRecord): Record<string, unknown> {
  const value = conflict.remoteSnapshot;
  if (!value || typeof value !== "object" || Array.isArray(value) || (value as Record<string, unknown>).id !== conflict.entityId ||
    !conflict.remoteVersion || !["draft", "completed"].includes((value as Record<string, unknown>).workflowStatus as string)) {
    throw new ConflictResolutionError("No hay una versión remota autorizada para resolver este conflicto");
  }
  return value as Record<string, unknown>;
}

function rechain(queue: readonly SyncQueueItem[], failed: SyncQueueItem, replacementId: string | null, remoteVersion: number): SyncQueueItem[] {
  return queue.filter((item) => item.operationId !== failed.operationId && item.dependsOn.includes(failed.operationId)).map((item) => {
    if (item.frozenRequest) throw new ConflictResolutionError("Hay una petición dependiente ya enviada; su contenido no se puede cambiar");
    return {
      ...item,
      dependsOn: item.dependsOn.flatMap((id) => id === failed.operationId ? replacementId ? [replacementId] : [] : [id]),
      ...(replacementId === null && item.entityId === failed.entityId ? { baseVersion: remoteVersion } : {}),
    };
  });
}

async function refreshRemote(context: ResolutionContext, conflict: ConflictRecord): Promise<ConflictRecord> {
  if (["key_reused", "inaccessible"].includes(conflict.reason)) return conflict;
  const evidence = await inspectConflict(context.client, conflict.failedOperation, new ApiClientError(409, conflict.error));
  if (!evidence?.remoteSnapshot || !evidence.remoteVersion) throw new ConflictResolutionError("No se pudo confirmar el estado remoto actual; inténtalo cuando haya conexión");
  await context.storage.updateConflictSnapshot(context.owner, conflict.operationId, evidence.remoteSnapshot, evidence.remoteVersion, evidence.reason);
  return { ...conflict, ...evidence };
}

function capturedInspection(remote: InspectionDetail, local: LocalInspection): LocalInspection {
  if (typeof remote.folioNumber !== "number" || remote.laboratoryId === undefined || remote.inspectionDate === undefined) throw new ConflictResolutionError("La lectura remota no contiene la captura necesaria");
  const now = new Date().toISOString();
  return {
    ...local, folioNumber: remote.folioNumber, laboratoryId: remote.laboratoryId,
    inspectionDate: remote.inspectionDate, summary: remote.scope, workflowStatus: remote.workflowStatus,
    version: remote.version, baseVersion: remote.version, syncStatus: "synced", localRevision: local.localRevision + 1,
    localUpdatedAt: now,
  };
}

function capturedFinding(remote: FindingDto, local: LocalFinding): LocalFinding {
  return {
    ...local, title: remote.title, description: remote.description, priority: remote.priority,
    status: remote.status, version: remote.version, baseVersion: remote.version,
    updatedAt: remote.updatedAt, resolvedAt: remote.resolvedAt,
    syncStatus: "synced", localRevision: local.localRevision + 1, localUpdatedAt: new Date().toISOString(),
  };
}

async function copyCapture(context: ResolutionContext, conflict: ConflictRecord, queue: readonly SyncQueueItem[]): Promise<ConflictResolutionWrite & { newInspectionId: string }> {
  const parentId = conflict.entity === "inspection" ? conflict.entityId : conflict.parentEntityId;
  if (!parentId) throw new ConflictResolutionError("No se conoce la inspección original");
  const parent = await context.storage.getInspection(context.owner, parentId);
  if (!parent) throw new ConflictResolutionError("La captura local original no está disponible");
  const findings = (await context.storage.listFindings(context.owner, parentId)).filter((finding) => !finding.deletedAt);
  const relatedIds = new Set([parentId, ...findings.map((finding) => finding.id)]);
  const related = queue.filter((item) => relatedIds.has(item.entityId) || item.parentEntityId === parentId);
  if (related.some((item) => item.operationId !== conflict.operationId && item.frozenRequest)) throw new ConflictResolutionError("Hay peticiones relacionadas ya enviadas; se conservan para revisión");
  const now = new Date().toISOString();
  const newInspectionId = crypto.randomUUID();
  const inspection: LocalInspection = {
    ...parent, id: newInspectionId, folioNumber: 0, inspectorId: context.owner, updatedBy: context.owner,
    workflowStatus: "draft", version: 0, baseVersion: null, completedAt: null, deletedAt: null,
    createdAt: now, updatedAt: now, localUpdatedAt: now, localRevision: 1, syncStatus: "pending",
  };
  const records: LocalEntityRecord[] = [{ store: "inspection_local", value: inspection }];
  const order = Math.max(0, ...queue.map((item) => item.localOrder)) + 1;
  const inspectionIntent = createIntent({
    owner: context.owner, entity: "inspection", entityId: newInspectionId, operation: "inspection.create",
    payload: { ...(inspection.laboratoryId ? { laboratoryId: inspection.laboratoryId } : {}), ...(inspection.inspectionDate ? { inspectionDate: inspection.inspectionDate } : {}), summary: inspection.summary },
    baseVersion: null, dependsOn: [], localOrder: order,
  });
  const enqueue = [inspectionIntent];
  for (let index = 0; index < findings.length; index++) {
    const finding = findings[index];
    const id = crypto.randomUUID();
    const fresh: LocalFinding = {
      ...finding, id, inspectionId: newInspectionId, createdBy: context.owner, updatedBy: context.owner,
      status: "pending", resolvedAt: null, deletedAt: null, version: 0, baseVersion: null,
      createdAt: now, updatedAt: now, localUpdatedAt: now, localRevision: 1, syncStatus: "pending",
    };
    records.push({ store: "finding_local", value: fresh });
    enqueue.push(createIntent({
      owner: context.owner, entity: "finding", entityId: id, parentEntityId: newInspectionId,
      operation: "finding.create", payload: { inspectionId: newInspectionId, title: fresh.title, description: fresh.description, priority: fresh.priority },
      baseVersion: null, dependsOn: [inspectionIntent.operationId], localOrder: order + index + 1,
    }));
  }
  return { records, enqueue, update: [], remove: related.map((item) => item.operationId), resolution: "copied", newInspectionId };
}

/** Manual decision; every mutation is committed with its queue rewiring under one account lease. */
export async function resolveConflict(context: ResolutionContext, operationId: string, decision: "mine" | "server"): Promise<{ newInspectionId?: string }> {
  const role = await context.verifyOwner(context.owner);
  if (!role) throw new ConflictResolutionError("La sesión ya no corresponde a esta cuenta");
  let conflict = await context.storage.getConflict(context.owner, operationId);
  if (!conflict || conflict.resolvedAt) throw new ConflictResolutionError("El conflicto ya no está pendiente");
  if (conflict.reason === "key_reused" || conflict.reason === "entity_reused" || conflict.reason === "inaccessible") throw new ConflictResolutionError("Esta operación requiere revisión; no se puede sobrescribir ni copiar desde una respuesta sin acceso");
  conflict = await refreshRemote(context, conflict);
  const remote = asRemote(conflict);
  const queue = await context.storage.listQueue(context.owner);
  const failed = queue.find((item) => item.operationId === operationId);
  if (!failed || !failed.frozenRequest) throw new ConflictResolutionError("La petición original no está disponible");
  const completedCapture = remote.workflowStatus === "completed" && failed.operation !== "finding.followup";
  let write: ConflictResolutionWrite;
  let newInspectionId: string | undefined;
  if (decision === "mine" && completedCapture) {
    if (role !== "technician") throw new ConflictResolutionError("Esta cuenta no puede crear un borrador nuevo");
    const copied = await copyCapture(context, conflict, queue);
    newInspectionId = copied.newInspectionId;
    write = copied;
  } else if (decision === "mine") {
    const editableCapture = role === "technician" && ["inspection.update", "finding.update", "inspection.discard", "finding.delete"].includes(failed.operation);
    const editableFollowup = role === "coordinator" && failed.operation === "finding.followup" && remote.workflowStatus === "completed";
    if (!editableCapture && !editableFollowup) throw new ConflictResolutionError("Esta edición no se puede reaplicar");
    const entity = conflict.entity === "inspection" ? await context.storage.getInspection(context.owner, conflict.entityId) : await context.storage.getFinding(context.owner, conflict.entityId);
    if (!entity || entity.deletedAt && !["inspection.discard", "finding.delete"].includes(failed.operation) || !conflict.remoteVersion) throw new ConflictResolutionError("Falta la captura editable o la versión remota");
    const payload: Record<string, unknown> = failed.operation === "inspection.update"
      ? { ...((entity as LocalInspection).laboratoryId ? { laboratoryId: (entity as LocalInspection).laboratoryId } : {}), ...((entity as LocalInspection).inspectionDate ? { inspectionDate: (entity as LocalInspection).inspectionDate } : {}), summary: (entity as LocalInspection).summary }
      : failed.operation === "finding.update"
        ? { title: (entity as LocalFinding).title, description: (entity as LocalFinding).description, priority: (entity as LocalFinding).priority }
        : failed.operation === "finding.followup"
          ? { ...(failed.payload as Record<string, unknown>) }
        : {};
    if (failed.operation === "finding.followup" && "status" in payload) {
      const current = remote.status;
      const target = payload.status;
      if (current !== target && !(current === "pending" && target === "in_review") && !(current === "in_review" && target === "resolved")) {
        throw new ConflictResolutionError("La transición de seguimiento ya no está permitida");
      }
    }
    const replacement = createIntent({
      owner: context.owner, entity: failed.entity, entityId: failed.entityId, parentEntityId: failed.parentEntityId,
      operation: failed.operation, payload, baseVersion: conflict.remoteVersion,
      dependsOn: failed.dependsOn.filter((id) => queue.some((item) => item.operationId === id)), localOrder: failed.localOrder,
    });
    write = { records: [], enqueue: [replacement], update: rechain(queue, failed, replacement.operationId, conflict.remoteVersion), remove: [operationId], resolution: "mine" };
  } else {
    const local = conflict.entity === "inspection" ? await context.storage.getInspection(context.owner, conflict.entityId) : await context.storage.getFinding(context.owner, conflict.entityId);
    if (!local) throw new ConflictResolutionError("Falta la entidad local para adoptar la versión remota");
    const record: LocalEntityRecord = conflict.entity === "inspection"
      ? { store: "inspection_local", value: capturedInspection(remote as InspectionDetail, local as LocalInspection) }
      : { store: "finding_local", value: capturedFinding(remote as FindingDto, local as LocalFinding) };
    write = { records: [record], enqueue: [], update: rechain(queue, failed, null, conflict.remoteVersion!), remove: [operationId], resolution: "server" };
  }
  const token = await context.storage.acquireLease(context.owner, Date.now(), 30_000);
  if (!token) throw new ConflictResolutionError("Hay una sincronización en curso; inténtalo de nuevo");
  try {
    if (!await context.verifyOwner(context.owner)) throw new ConflictResolutionError("La sesión cambió durante la resolución");
    await context.storage.resolveConflict(context.owner, operationId, write, token);
  } finally {
    await context.storage.releaseLease(context.owner, token);
  }
  return newInspectionId ? { newInspectionId } : {};
}
