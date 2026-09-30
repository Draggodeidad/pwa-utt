import { DomainValidationError, expectIsoDate, expectOnlyKeys, expectRecord, expectString, expectUuid, isRecord } from "../../../types/entity.ts";

export type InspectionDraftInput = {
  laboratoryId?: string;
  inspectionDate?: string;
  summary?: string;
};

export type InspectionFinalizeInput = {
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
  expectOnlyKeys(record, ["expectedFindingIds"], "payload");
  if (!Array.isArray(record.expectedFindingIds)) {
    throw new DomainValidationError([{ path: "payload.expectedFindingIds", message: "must be an array" }]);
  }

  return {
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
