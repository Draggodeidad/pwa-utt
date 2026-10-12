import { DomainValidationError, expectIsoDate, expectOnlyKeys, expectRecord, expectString, expectUuid, isRecord } from "../../../types/entity.ts";

export type InspectionDraftInput = {
  laboratoryId?: string;
  inspectionDate?: string;
  summary?: string;
};

import type { InspectionLocation } from "../types.ts";

export type InspectionFinalizeInput = {
  location?: InspectionLocation | null;
  expectedFindingIds: string[];
};

const draftKeys = ["laboratoryId", "inspectionDate", "summary"] as const;
const summaryLimit = 4_000;

/** Drafts are structurally valid even when all finalization fields are absent. */
export function validateInspectionDraft(input: unknown): InspectionDraftInput {
  const record = expectRecord(input, "payload");
  expectOnlyKeys(record, draftKeys, "payload");
  const draft: InspectionDraftInput = {};

  if ("laboratoryId" in record) draft.laboratoryId = expectUuid(record.laboratoryId, "payload.laboratoryId");
  if ("inspectionDate" in record) draft.inspectionDate = expectIsoDate(record.inspectionDate, "payload.inspectionDate");
  if ("summary" in record) draft.summary = expectString(record.summary, "payload.summary", { max: summaryLimit });

  return draft;
}

/** Updates must change a field, unlike creation where an empty draft is allowed. */
export function validateInspectionUpdate(input: unknown): InspectionDraftInput {
  const draft = validateInspectionDraft(input);
  if (Object.keys(draft).length === 0) {
    throw new DomainValidationError([{ path: "payload", message: "requires at least one editable field" }]);
  }

  return draft;
}

/** Finalization uses DEC-08's required field matrix, not the permissive draft rules. */
export function validateInspectionForFinalization(input: unknown): Required<InspectionDraftInput> {
  const record = expectRecord(input, "payload");
  expectOnlyKeys(record, draftKeys, "payload");
  return {
    laboratoryId: expectUuid(record.laboratoryId, "payload.laboratoryId"),
    inspectionDate: expectIsoDate(record.inspectionDate, "payload.inspectionDate"),
    summary: expectString(record.summary, "payload.summary", { min: 1, max: summaryLimit, trim: true }),
  };
}

export function validateInspectionFinalization(input: unknown): InspectionFinalizeInput {
  const record = expectRecord(input, "payload");
  expectOnlyKeys(record, ["expectedFindingIds", "location"], "payload");
  if (!Array.isArray(record.expectedFindingIds)) {
    throw new DomainValidationError([{ path: "payload.expectedFindingIds", message: "must be an array" }]);
  }

  return {
    ...("location" in record ? { location: validateInspectionLocation(record.location) } : {}),
    expectedFindingIds: record.expectedFindingIds.map((id, index) => expectUuid(id, `payload.expectedFindingIds[${index}]`)),
  };
}

/** Legacy UI helper retained until presentation fixtures are migrated. */
export function hasRequiredInspectionFields(input: InspectionDraftInput) {
  return Boolean(input.laboratoryId && input.inspectionDate && input.summary?.trim());
}

export function isInspectionDraftInput(value: unknown): value is InspectionDraftInput {
  if (!isRecord(value)) return false;
  try {
    validateInspectionDraft(value);
    return true;
  } catch {
    return false;
  }
}

/** Complete, bounded snapshot; null explicitly means no consented capture. */
export function validateInspectionLocation(input: unknown): InspectionLocation | null {
  if (input === null) return null;
  const record = expectRecord(input, "payload.location");
  expectOnlyKeys(record, ["latitude", "longitude", "accuracy", "capturedAt"], "payload.location");
  const number = (key: string, min: number, max: number) => {
    const value = record[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      throw new DomainValidationError([{ path: `payload.location.${key}`, message: "must be a finite number in range" }]);
    }
    return value;
  };
  const capturedAt = expectString(record.capturedAt, "payload.location.capturedAt", { min: 1, max: 24 });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(capturedAt) || !Number.isFinite(Date.parse(capturedAt)) || new Date(capturedAt).toISOString().slice(0, 19) !== capturedAt.slice(0, 19)) {
    throw new DomainValidationError([{ path: "payload.location.capturedAt", message: "must be a UTC ISO timestamp" }]);
  }
  return { latitude: number("latitude", -90, 90), longitude: number("longitude", -180, 180), accuracy: number("accuracy", 0, Number.MAX_VALUE), capturedAt };
}
