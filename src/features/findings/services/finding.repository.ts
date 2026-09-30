import type { Finding, FindingPriority, FindingStatus } from "../types";
import type { FindingCaptureInput } from "../schemas/finding.schema";
import type { OperationAcknowledgement } from "@/features/sync/types";

export interface FindingRepository {
  listByInspection(inspectionId: string): Promise<Finding[]>;
  getById(id: string): Promise<Finding | null>;
  create(id: string, capture: Required<Pick<FindingCaptureInput, "inspectionId">> & FindingCaptureInput): Promise<OperationAcknowledgement>;
  update(id: string, baseVersion: number, capture: FindingCaptureInput): Promise<OperationAcknowledgement>;
  delete(id: string, baseVersion: number): Promise<OperationAcknowledgement>;
  followup(id: string, baseVersion: number, changes: { priority?: FindingPriority; status?: FindingStatus }): Promise<OperationAcknowledgement>;
}
