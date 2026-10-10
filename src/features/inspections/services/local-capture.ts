import type { PhotoEdits } from "../../findings/photo-contracts.ts";
import type { LocalStorage, LocalEntityRecord } from "../../../lib/pwa/offline-storage.ts";
import type { InspectionLocation, LocalInspection, InspectionEditorValues, InspectionFinding, InspectionListItem, LaboratoryOption, InspectionWorkflowStatus } from "../types.ts";
import type { LocalFinding } from "../../findings/types.ts";
import type { DomainOperationKind, SyncEntityKind, SyncQueueItem } from "../../sync/types.ts";
import type { SyncStatus, Uuid } from "../../../types/entity.ts";

export type RemovedFindingRef = { id: string; baseVersion: number | null };

export type DraftCapture = {
  owner: Uuid;
  inspection: LocalInspection;
  findings: readonly LocalFinding[];
  removedFindings: readonly RemovedFindingRef[];
  photos?: PhotoEdits;
};

export type FindingsCapture = {
  owner: Uuid;
  inspectionId?: string;
  findings: readonly LocalFinding[];
  removedFindings: readonly RemovedFindingRef[];
};

export type FinalizeCapture = DraftCapture & { expectedFindingIds: readonly string[]; location?: InspectionLocation | null };

export function createIntent(input: {
  owner: Uuid;
  entity: SyncEntityKind;
  entityId: string;
  parentEntityId?: string;
  operation: DomainOperationKind;
  payload: Record<string, unknown>;
  baseVersion: number | null;
  dependsOn: readonly string[];
  localOrder: number;
}): SyncQueueItem {
  return {
    operationId: crypto.randomUUID(),
    ownerUserId: input.owner,
    entity: input.entity,
    entityId: input.entityId,
    ...(input.parentEntityId ? { parentEntityId: input.parentEntityId } : {}),
    operation: input.operation,
    payload: input.payload,
    baseVersion: input.baseVersion,
    dependsOn: [...input.dependsOn],
    localOrder: input.localOrder,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
}

function draftPayload(inspection: LocalInspection): Record<string, unknown> {
  const payload: Record<string, unknown> = { summary: inspection.summary };
  if (inspection.laboratoryId) payload.laboratoryId = inspection.laboratoryId;
  if (inspection.inspectionDate) payload.inspectionDate = inspection.inspectionDate;
  return payload;
}

function lastForEntity(queue: readonly SyncQueueItem[], entityId: string): SyncQueueItem | undefined {
  return queue.filter((item) => item.entityId === entityId).at(-1);
}

function nextOrder(queue: readonly SyncQueueItem[]): number {
  return Math.max(0, ...queue.map((item) => item.localOrder)) + 1;
}

function buildCaptureIntents(draft: DraftCapture, queue: readonly SyncQueueItem[]): SyncQueueItem[] {
  const intents: SyncQueueItem[] = [];
  const precedingInspection = lastForEntity(queue, draft.inspection.id);
  const inspectionCreate = draft.inspection.baseVersion === null && !precedingInspection;
  let order = nextOrder(queue);
  const inspectionIntent = createIntent({
    owner: draft.owner,
    entity: "inspection",
    entityId: draft.inspection.id,
    operation: inspectionCreate ? "inspection.create" : "inspection.update",
    payload: draftPayload(draft.inspection),
    baseVersion: draft.inspection.baseVersion,
    dependsOn: precedingInspection ? [precedingInspection.operationId] : [],
    localOrder: order++,
  });
  intents.push(inspectionIntent);
  for (const intent of buildFindingIntents({ ...draft, inspectionId: draft.inspection.id }, inspectionIntent.operationId, order, [...queue, inspectionIntent])) intents.push(intent);
  return intents;
}

function buildFindingIntents(capture: FindingsCapture, inspectionIntentId: string | null, startOrder: number, queue: readonly SyncQueueItem[]): SyncQueueItem[] {
  const intents: SyncQueueItem[] = [];
  let order = startOrder;
  for (const finding of capture.findings) {
    const preceding = lastForEntity([...queue, ...intents], finding.id);
    const isCreate = finding.baseVersion === null && !preceding;
    intents.push(createIntent({
      owner: capture.owner,
      entity: "finding",
      entityId: finding.id,
      parentEntityId: finding.inspectionId,
      operation: isCreate ? "finding.create" : "finding.update",
      payload: isCreate
        ? { inspectionId: finding.inspectionId, title: finding.title, description: finding.description, priority: finding.priority }
        : { title: finding.title, description: finding.description, priority: finding.priority },
      baseVersion: finding.baseVersion,
      dependsOn: [...(preceding ? [preceding.operationId] : []), ...(inspectionIntentId ? [inspectionIntentId] : [])],
      localOrder: order++,
    }));
  }
  for (const removed of capture.removedFindings) {
    const preceding = lastForEntity([...queue, ...intents], removed.id);
    if (removed.baseVersion === null && !preceding?.frozenRequest) continue;
    intents.push(createIntent({
      owner: capture.owner,
      entity: "finding",
      entityId: removed.id,
      parentEntityId: capture.inspectionId ?? capture.findings[0]?.inspectionId,
      operation: "finding.delete",
      payload: {},
      baseVersion: removed.baseVersion,
      dependsOn: preceding ? [preceding.operationId] : [],
      localOrder: order++,
    }));
  }
  return intents;
}

/** Persists the draft (entity + findings) and every capture intent atomically. */
export async function saveDraft(owner: Uuid, storage: LocalStorage, draft: DraftCapture): Promise<SyncQueueItem[]> {
  const records: LocalEntityRecord[] = [
    { store: "inspection_local", value: draft.inspection },
    ...draft.findings.map((finding) => ({ store: "finding_local" as const, value: finding })),
  ];
  const intents = buildCaptureIntents(draft, await storage.listQueue(owner));
  await storage.saveCapture(owner, records, intents, draft.removedFindings, draft.photos);
  return intents;
}

/** Persists findings and their intents without touching the inspection (detail-only edits). */
export async function saveFindings(owner: Uuid, storage: LocalStorage, capture: FindingsCapture): Promise<SyncQueueItem[]> {
  const records: LocalEntityRecord[] = capture.findings.map((finding) => ({ store: "finding_local" as const, value: finding }));
  const queue = await storage.listQueue(owner);
  const parentId = capture.inspectionId ?? capture.findings[0]?.inspectionId;
  const parentIntent = parentId ? lastForEntity(queue, parentId) : undefined;
  const intents = buildFindingIntents(capture, parentIntent?.operationId ?? null, nextOrder(queue), queue);
  await storage.saveCapture(owner, records, intents, capture.removedFindings);
  return intents;
}

/** Appends a finalize intent ordered after the inspection's pending intents. */
export async function enqueueFinalizeIntent(owner: Uuid, storage: LocalStorage, input: { inspectionId: string; baseVersion: number | null; expectedFindingIds: readonly string[]; location?: InspectionLocation | null }): Promise<SyncQueueItem> {
  const queue = await storage.listQueue(owner);
  const findings = await storage.listFindings(owner, input.inspectionId);
  const findingIds = new Set([...findings.map((finding) => finding.id), ...input.expectedFindingIds]);
  const dependencies = queue.filter((item) => item.entityId === input.inspectionId || item.parentEntityId === input.inspectionId || findingIds.has(item.entityId));
  const intent = createIntent({
    owner,
    entity: "inspection",
    entityId: input.inspectionId,
    operation: "inspection.finalize",
    payload: { expectedFindingIds: [...input.expectedFindingIds], location: input.location ?? null },
    baseVersion: input.baseVersion,
    dependsOn: dependencies.map((item) => item.operationId),
    localOrder: nextOrder(queue),
  });
  await storage.enqueue(owner, intent);
  const existing = await storage.getInspection(owner, input.inspectionId);
  if (existing) {
    await storage.saveInspection(owner, { ...existing, syncStatus: "pending", localUpdatedAt: new Date().toISOString() });
  }
  return intent;
}

/** Persists the capture and appends a finalize intent ordered after it. */
export async function finalizeDraft(owner: Uuid, storage: LocalStorage, capture: FinalizeCapture): Promise<SyncQueueItem> {
  const inspection: LocalInspection = { ...capture.inspection, syncStatus: "pending" };
  const records: LocalEntityRecord[] = [
    { store: "inspection_local", value: inspection },
    ...capture.findings.map((finding) => ({ store: "finding_local" as const, value: finding })),
  ];
  const existingQueue = await storage.listQueue(owner);
  const intents = buildCaptureIntents({ ...capture, inspection }, existingQueue);
  const finalizeIntent = createIntent({
    owner,
    entity: "inspection",
    entityId: inspection.id,
    operation: "inspection.finalize",
    payload: { expectedFindingIds: [...capture.expectedFindingIds], location: capture.location ?? null },
    baseVersion: inspection.baseVersion,
    dependsOn: [...existingQueue, ...intents].filter((item) =>
      item.entityId === inspection.id || item.parentEntityId === inspection.id || capture.findings.some((finding) => finding.id === item.entityId) || capture.removedFindings.some((finding) => finding.id === item.entityId)
    ).map((item) => item.operationId),
    localOrder: nextOrder([...existingQueue, ...intents]),
  });
  await storage.saveCapture(owner, records, [...intents, finalizeIntent], capture.removedFindings);
  return finalizeIntent;
}

/** Discards a draft: atomic cancel when never ACKed, tombstone + ordered discard otherwise. */
export async function discardDraft(owner: Uuid, storage: LocalStorage, inspectionId: string): Promise<void> {
  const inspection = await storage.getInspection(owner, inspectionId);
  if (!inspection || inspection.deletedAt !== null) return;
  const queue = await storage.listQueue(owner);
  const related = queue.filter((item) => item.entityId === inspectionId || item.parentEntityId === inspectionId);
  if (inspection.baseVersion === null && !related.some((item) => item.frozenRequest)) {
    await storage.removeCapture(owner, inspectionId);
    return;
  }
  const discardIntent = createIntent({
    owner,
    entity: "inspection",
    entityId: inspectionId,
    operation: "inspection.discard",
    payload: {},
    baseVersion: inspection.baseVersion,
    dependsOn: related.map((item) => item.operationId),
    localOrder: nextOrder(queue),
  });
  const tombstone: LocalInspection = {
    ...inspection,
    deletedAt: new Date().toISOString(),
    syncStatus: "pending",
    localUpdatedAt: new Date().toISOString(),
  };
  await storage.discardCapture(owner, tombstone, discardIntent);
}

/** Loads a recoverable local draft (inspection + non-deleted findings). */
export async function loadLocalDraft(owner: Uuid, storage: LocalStorage, inspectionId: string): Promise<{ inspection: LocalInspection; findings: LocalFinding[] } | null> {
  const inspection = await storage.getInspection(owner, inspectionId);
  if (!inspection || inspection.deletedAt !== null) return null;
  const findings = await storage.listFindings(owner, inspectionId);
  return { inspection, findings: findings.filter((finding) => finding.deletedAt === null) };
}

/** True when the queue still carries a pending finalize intent for the inspection. */
export async function hasPendingFinalization(owner: Uuid, storage: LocalStorage, inspectionId: string): Promise<boolean> {
  const queue = await storage.listQueue(owner);
  return queue.some((item) => item.entityId === inspectionId && item.operation === "inspection.finalize");
}

/**
 * Merges an authorized remote refresh into the local list without clobbering
 * pending local edits and without resurrecting discarded tombstones.
 */
export function mergeRemoteRefresh(local: readonly InspectionListItem[], remote: readonly InspectionListItem[], tombstonedIds: ReadonlySet<string> = new Set()): InspectionListItem[] {
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const result: InspectionListItem[] = [];
  const present = new Set<string>();
  for (const item of local) {
    present.add(item.id);
    if (tombstonedIds.has(item.id)) continue;
    if (item.syncStatus !== "synced") {
      result.push(item);
      continue;
    }
    result.push(remoteById.get(item.id) ?? item);
  }
  for (const item of remote) {
    if (present.has(item.id) || tombstonedIds.has(item.id)) continue;
    result.push(item);
  }
  return result;
}

/** Converts a local inspection into the shared list shape for the same-source view. */
export function toLocalInspectionListItem(local: LocalInspection, findingCount: number, technician: string, catalog: readonly LaboratoryOption[], pendingFindingCount = findingCount): InspectionListItem {
  const laboratory = local.laboratoryId ? catalog.find((option) => option.id === local.laboratoryId) : undefined;
  return {
    id: local.id,
    location: laboratory?.name ?? "Laboratorio no asignado",
    laboratoryCode: laboratory?.code ?? "—",
    date: local.inspectionDate ?? "",
    summary: local.summary,
    syncStatus: local.syncStatus,
    inspector: technician,
    workflowStatus: local.workflowStatus,
    findingCount,
    pendingFindingCount,
    result: findingCount ? "requires_attention" : "without_findings",
  };
}

/** Builds a durable local inspection from editor values, preserving server fields. */
export function toLocalInspection(
  id: string,
  values: Pick<InspectionEditorValues, "laboratoryCode" | "date" | "summary" | "syncStatus" | "version">,
  owner: Uuid,
  catalog: readonly LaboratoryOption[],
  existing: LocalInspection | null
): LocalInspection {
  const laboratory = catalog.find((option) => option.code === values.laboratoryCode);
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? id,
    folioNumber: existing?.folioNumber ?? 0,
    laboratoryId: laboratory?.id ?? existing?.laboratoryId ?? null,
    inspectorId: existing?.inspectorId ?? owner,
    inspectionDate: values.date || null,
    summary: values.summary,
    workflowStatus: existing?.workflowStatus ?? "draft",
    updatedBy: owner,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: existing?.version ?? values.version ?? 0,
    completedAt: existing?.completedAt ?? null,
    deletedAt: existing?.deletedAt ?? null,
    ownerUserId: owner,
    localRevision: (existing?.localRevision ?? 0) + 1,
    baseVersion: existing ? existing.baseVersion : values.version ?? null,
    syncStatus: values.syncStatus ?? "local",
    localUpdatedAt: now,
  };
}

/** Builds a durable local finding, preserving its server base version when known. */
export function toLocalFinding(
  id: string,
  inspectionId: string,
  finding: Pick<InspectionFinding, "title" | "description" | "priority" | "status">,
  owner: Uuid,
  baseVersion: number | null,
  existing: LocalFinding | null
): LocalFinding {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? id,
    inspectionId,
    title: finding.title,
    description: finding.description,
    priority: finding.priority,
    status: finding.status,
    createdBy: existing?.createdBy ?? owner,
    updatedBy: owner,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: existing?.version ?? 0,
    resolvedAt: existing?.resolvedAt ?? null,
    deletedAt: existing?.deletedAt ?? null,
    ownerUserId: owner,
    localRevision: (existing?.localRevision ?? 0) + 1,
    baseVersion: existing ? existing.baseVersion : baseVersion,
    syncStatus: "local",
    localUpdatedAt: now,
  };
}

/** Presents a recovered local draft in the editor value shape. */
export function toEditorValues(local: LocalInspection, findings: readonly LocalFinding[], catalog: readonly LaboratoryOption[], technician: string): InspectionEditorValues {
  const laboratory = local.laboratoryId ? catalog.find((option) => option.id === local.laboratoryId) : undefined;
  return {
    id: local.id,
    folio: local.folioNumber ? `INS-${local.folioNumber}` : "—",
    laboratoryCode: laboratory?.code ?? "",
    date: local.inspectionDate ?? "",
    technician,
    summary: local.summary,
    findings: findings.map((finding) => ({
      id: finding.id,
      priority: finding.priority,
      status: finding.status,
      title: finding.title,
      description: finding.description,
      version: finding.baseVersion,
    })),
    syncStatus: local.syncStatus,
    version: local.baseVersion,
  };
}

/** The shared workflow status of a local inspection, derived without remote state. */
export function localWorkflowStatus(local: LocalInspection): InspectionWorkflowStatus {
  return local.deletedAt === null ? local.workflowStatus : "draft";
}

export type { SyncStatus };
