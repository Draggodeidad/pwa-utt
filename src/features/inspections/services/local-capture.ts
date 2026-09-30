import type { LocalStorage, LocalEntityRecord } from "../../../lib/pwa/offline-storage.ts";
import type { LocalInspection, InspectionEditorValues, InspectionFinding, InspectionListItem, LaboratoryOption, InspectionWorkflowStatus } from "../types.ts";
import type { LocalFinding } from "../../findings/types.ts";
import type { DomainOperationKind, SyncEntityKind, SyncQueueItem } from "../../sync/types.ts";
import type { SyncStatus, Uuid } from "../../../types/entity.ts";

export type RemovedFindingRef = { id: string; baseVersion: number | null };

export type DraftCapture = {
  owner: Uuid;
  inspection: LocalInspection;
  findings: readonly LocalFinding[];
  removedFindings: readonly RemovedFindingRef[];
};

export type FindingsCapture = {
  owner: Uuid;
  findings: readonly LocalFinding[];
  removedFindings: readonly RemovedFindingRef[];
};

export type FinalizeCapture = DraftCapture & { expectedFindingIds: readonly string[] };

export function createIntent(input: {
  owner: Uuid;
  entity: SyncEntityKind;
  entityId: string;
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

function buildCaptureIntents(draft: DraftCapture): SyncQueueItem[] {
  const intents: SyncQueueItem[] = [];
  const inspectionCreate = draft.inspection.baseVersion === null;
  let order = 1;
  const inspectionIntent = createIntent({
    owner: draft.owner,
    entity: "inspection",
    entityId: draft.inspection.id,
    operation: inspectionCreate ? "inspection.create" : "inspection.update",
    payload: draftPayload(draft.inspection),
    baseVersion: draft.inspection.baseVersion,
    dependsOn: [],
    localOrder: order++,
  });
  intents.push(inspectionIntent);
  for (const intent of buildFindingIntents(draft, inspectionIntent.operationId, order)) intents.push(intent);
  return intents;
}

function buildFindingIntents(capture: FindingsCapture, inspectionIntentId: string | null, startOrder: number): SyncQueueItem[] {
  const intents: SyncQueueItem[] = [];
  let order = startOrder;
  for (const finding of capture.findings) {
    const isCreate = finding.baseVersion === null;
    intents.push(createIntent({
      owner: capture.owner,
      entity: "finding",
      entityId: finding.id,
      operation: isCreate ? "finding.create" : "finding.update",
      payload: { title: finding.title, description: finding.description, priority: finding.priority },
      baseVersion: finding.baseVersion,
      dependsOn: isCreate && inspectionIntentId ? [inspectionIntentId] : [],
      localOrder: order++,
    }));
  }
  for (const removed of capture.removedFindings) {
    if (removed.baseVersion === null) continue;
    intents.push(createIntent({
      owner: capture.owner,
      entity: "finding",
      entityId: removed.id,
      operation: "finding.delete",
      payload: {},
      baseVersion: removed.baseVersion,
      dependsOn: [],
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
  const intents = buildCaptureIntents(draft);
  await storage.saveCapture(owner, records, intents);
  return intents;
}

/** Persists findings and their intents without touching the inspection (detail-only edits). */
export async function saveFindings(owner: Uuid, storage: LocalStorage, capture: FindingsCapture): Promise<SyncQueueItem[]> {
  const records: LocalEntityRecord[] = capture.findings.map((finding) => ({ store: "finding_local" as const, value: finding }));
  const intents = buildFindingIntents(capture, null, 1);
  await storage.saveCapture(owner, records, intents);
  return intents;
}

/** Appends a finalize intent ordered after the inspection's pending intents. */
export async function enqueueFinalizeIntent(owner: Uuid, storage: LocalStorage, input: { inspectionId: string; baseVersion: number | null; expectedFindingIds: readonly string[] }): Promise<SyncQueueItem> {
  const queue = await storage.listQueue(owner);
  const related = queue.filter((item) => item.entityId === input.inspectionId);
  const lastOrder = related.length ? Math.max(...related.map((item) => item.localOrder)) : 0;
  const intent = createIntent({
    owner,
    entity: "inspection",
    entityId: input.inspectionId,
    operation: "inspection.finalize",
    payload: { expectedFindingIds: [...input.expectedFindingIds] },
    baseVersion: input.baseVersion,
    dependsOn: related.length ? [related[related.length - 1].operationId] : [],
    localOrder: lastOrder + 1,
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
  const intents = buildCaptureIntents({ ...capture, inspection });
  const finalizeIntent = createIntent({
    owner,
    entity: "inspection",
    entityId: inspection.id,
    operation: "inspection.finalize",
    payload: { expectedFindingIds: [...capture.expectedFindingIds] },
    baseVersion: inspection.baseVersion,
    dependsOn: intents.map((intent) => intent.operationId),
    localOrder: intents.length + 1,
  });
  await storage.saveCapture(owner, records, [...intents, finalizeIntent]);
  return finalizeIntent;
}

/** Discards a draft: atomic cancel when never ACKed, tombstone + ordered discard otherwise. */
export async function discardDraft(owner: Uuid, storage: LocalStorage, inspectionId: string): Promise<void> {
  const inspection = await storage.getInspection(owner, inspectionId);
  if (!inspection || inspection.deletedAt !== null) return;
  if (inspection.baseVersion === null) {
    await storage.removeCapture(owner, inspectionId);
    return;
  }
  const queue = await storage.listQueue(owner);
  const related = queue.filter((item) => item.entityId === inspectionId);
  const lastOrder = related.length ? Math.max(...related.map((item) => item.localOrder)) : 0;
  const discardIntent = createIntent({
    owner,
    entity: "inspection",
    entityId: inspectionId,
    operation: "inspection.discard",
    payload: {},
    baseVersion: inspection.baseVersion,
    dependsOn: related.length ? [related[related.length - 1].operationId] : [],
    localOrder: lastOrder + 1,
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
export function toLocalInspectionListItem(local: LocalInspection, findingCount: number, technician: string, catalog: readonly LaboratoryOption[]): InspectionListItem {
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
    result: findingCount ? "requires_attention" : "without_findings",
  };
}

/** Builds a durable local inspection from editor values, preserving server fields. */
export function toLocalInspection(
  id: string,
  values: Pick<InspectionEditorValues, "laboratoryCode" | "date" | "summary" | "syncStatus">,
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
    version: existing?.version ?? 0,
    completedAt: existing?.completedAt ?? null,
    deletedAt: existing?.deletedAt ?? null,
    ownerUserId: owner,
    localRevision: (existing?.localRevision ?? 0) + 1,
    baseVersion: existing?.baseVersion ?? null,
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
    baseVersion: existing?.baseVersion ?? baseVersion,
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