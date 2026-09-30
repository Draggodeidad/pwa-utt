import type { FindingPriority, FindingStatus } from "../types";
import { DomainValidationError, expectOnlyKeys, expectRecord, expectString, expectUuid } from "../../../types/entity.ts";

export type FindingCaptureInput = {
  inspectionId?: string;
  title?: string;
  description?: string;
  priority?: FindingPriority;
};

export type FindingFollowupInput = {
  priority?: FindingPriority;
  status?: FindingStatus;
};

const priorityValues: readonly FindingPriority[] = ["low", "medium", "high"];
const statusValues: readonly FindingStatus[] = ["pending", "in_review", "resolved"];

function expectEnum<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new DomainValidationError([{ path, message: "is invalid" }]);
  }
  return value as T;
}

export function validateFindingCapture(input: unknown, mode: "create" | "update"): FindingCaptureInput {
  const record = expectRecord(input, "payload");
  const keys = mode === "create" ? ["inspectionId", "title", "description", "priority"] : ["title", "description", "priority"];
  expectOnlyKeys(record, keys, "payload");
  if (mode === "update" && Object.keys(record).length === 0) throw new DomainValidationError([{ path: "payload", message: "requires at least one editable field" }]);

  const result: FindingCaptureInput = {};
  if (mode === "create") result.inspectionId = expectUuid(record.inspectionId, "payload.inspectionId");
  if ("title" in record) result.title = expectString(record.title, "payload.title", { max: 500 });
  if ("description" in record) result.description = expectString(record.description, "payload.description", { max: 4_000 });
  if ("priority" in record) result.priority = expectEnum(record.priority, "payload.priority", priorityValues);
  return result;
}

/** Only non-deleted findings being finalized require a non-blank title. */
export function validateFindingForFinalization(input: FindingCaptureInput) {
  return {
    title: expectString(input.title, "payload.title", { min: 1, max: 500, trim: true }),
    description: input.description === undefined ? undefined : expectString(input.description, "payload.description", { max: 4_000 }),
    priority: input.priority ?? "medium",
  };
}

export function validateFindingFollowup(input: unknown): FindingFollowupInput {
  const record = expectRecord(input, "payload");
  expectOnlyKeys(record, ["priority", "status"], "payload");
  if (Object.keys(record).length === 0) throw new DomainValidationError([{ path: "payload", message: "requires priority or status" }]);

  const result: FindingFollowupInput = {};
  if ("priority" in record) result.priority = expectEnum(record.priority, "payload.priority", priorityValues);
  if ("status" in record) result.status = expectEnum(record.status, "payload.status", statusValues);
  return result;
}
