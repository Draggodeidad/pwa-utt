import { validateFindingCapture, validateFindingFollowup } from "../findings/schemas/finding.schema.ts";
import type { FindingCaptureInput, FindingFollowupInput } from "../findings/schemas/finding.schema.ts";
import { validateInspectionDraft, validateInspectionFinalization, validateInspectionUpdate } from "../inspections/schemas/inspection.schema.ts";
import type { InspectionDraftInput, InspectionFinalizeInput } from "../inspections/schemas/inspection.schema.ts";
import { DomainValidationError, expectOnlyKeys, expectPositiveInteger, expectRecord, expectUuid } from "../../types/entity.ts";
import type { SyncStatus, Uuid } from "../../types/entity.ts";

export type SyncEntityKind = "inspection" | "finding";
export type SyncOperation = "create" | "update" | "delete" | "discard" | "finalize" | "followup";
export type DomainOperationKind =
  | "inspection.create"
  | "inspection.update"
  | "inspection.discard"
  | "inspection.finalize"
  | "finding.create"
  | "finding.update"
  | "finding.delete"
  | "finding.followup";

type OperationBase<K extends DomainOperationKind, P> = {
  clientId: Uuid;
  kind: K;
  entityId: Uuid;
  baseVersion: number | null;
  payload: P;
};

export type DomainOperation =
  | OperationBase<"inspection.create", InspectionDraftInput>
  | OperationBase<"inspection.update", InspectionDraftInput>
  | OperationBase<"inspection.discard", Record<string, never>>
  | OperationBase<"inspection.finalize", InspectionFinalizeInput>
  | OperationBase<"finding.create", FindingCaptureInput>
  | OperationBase<"finding.update", FindingCaptureInput>
  | OperationBase<"finding.delete", Record<string, never>>
  | OperationBase<"finding.followup", FindingFollowupInput>;

export type OperationAcknowledgement = {
  operationId: Uuid;
  entityId: Uuid;
  entityType: SyncEntityKind;
  version: number;
  appliedAt: string;
  replayed: boolean;
};

export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "FINDING_SET_CONFLICT"
  | "IDEMPOTENCY_KEY_REUSED"
  | "VALIDATION_ERROR";

export type DomainOperationError = {
  code: DomainErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  localSnapshot?: unknown;
  remoteSnapshot?: unknown;
};

export type SyncViewState = "loading" | "offline" | "idle" | "syncing" | "success" | "error" | "empty";
export type SyncQueueRecordStatus = "pending" | "syncing" | "error";

/** Durable local queue representation; the payload is the exact operation payload. */
export type SyncQueueItem = {
  operationId: Uuid;
  ownerUserId: Uuid;
  entity: SyncEntityKind;
  entityId: Uuid;
  operation: DomainOperationKind;
  payload: DomainOperation["payload"];
  baseVersion: number | null;
  dependsOn: readonly Uuid[];
  localOrder: number;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: DomainOperationError | null;
  createdAt: string;
  status: Extract<SyncStatus, "pending" | "syncing" | "error">;
};

/** Read model for the technician's local inspection queue. */
export type SyncQueueRecord = {
  id: string;
  folio: string;
  laboratory: string;
  date: string;
  status: SyncQueueRecordStatus;
};

const operationKinds: readonly DomainOperationKind[] = [
  "inspection.create", "inspection.update", "inspection.discard", "inspection.finalize",
  "finding.create", "finding.update", "finding.delete", "finding.followup",
];

/** Validates the common JSON body; the Idempotency-Key is validated separately as operationId. */
export function validateDomainOperation(input: unknown): DomainOperation {
  const record = expectRecord(input, "body");
  expectOnlyKeys(record, ["clientId", "kind", "entityId", "baseVersion", "payload"], "body");
  const clientId = expectUuid(record.clientId, "body.clientId");
  const entityId = expectUuid(record.entityId, "body.entityId");
  if (typeof record.kind !== "string" || !operationKinds.includes(record.kind as DomainOperationKind)) throw new DomainValidationError([{ path: "body.kind", message: "is invalid" }]);
  const kind = record.kind as DomainOperationKind;
  const isCreation = kind === "inspection.create" || kind === "finding.create";
  const baseVersion = isCreation ? null : expectPositiveInteger(record.baseVersion, "body.baseVersion");
  if (isCreation && record.baseVersion !== null && record.baseVersion !== undefined) throw new DomainValidationError([{ path: "body.baseVersion", message: "must be absent for creation" }]);

  const payload = validatePayload(kind, record.payload);
  return { clientId, kind, entityId, baseVersion, payload } as DomainOperation;
}

export function validateOperationId(value: unknown): Uuid {
  return expectUuid(value, "Idempotency-Key");
}

function validatePayload(kind: DomainOperationKind, payload: unknown) {
  switch (kind) {
    case "inspection.create": return validateInspectionDraft(payload);
    case "inspection.update": return validateInspectionUpdate(payload);
    case "inspection.discard": return validateEmptyPayload(payload);
    case "inspection.finalize": return validateInspectionFinalization(payload);
    case "finding.create": return validateFindingCapture(payload, "create");
    case "finding.update": return validateFindingCapture(payload, "update");
    case "finding.delete": return validateEmptyPayload(payload);
    case "finding.followup": return validateFindingFollowup(payload);
  }
}

function validateEmptyPayload(payload: unknown): Record<string, never> {
  const record = expectRecord(payload, "payload");
  expectOnlyKeys(record, [], "payload");
  return {};
}
