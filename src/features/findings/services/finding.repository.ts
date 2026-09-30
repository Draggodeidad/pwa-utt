import type { FindingDto } from "../types";
import type { FindingCaptureInput, FindingFollowupInput } from "../schemas/finding.schema";
import type { OperationAcknowledgement } from "@/features/sync/types";

/** Port implemented by an API-backed or offline-first data source. */
export interface FindingRepository {
  listByInspection(inspectionId: string): Promise<FindingDto[]>;
  getById(id: string): Promise<FindingDto | null>;
  create(id: string, capture: FindingCaptureInput): Promise<OperationAcknowledgement>;
  update(id: string, baseVersion: number, capture: FindingCaptureInput): Promise<OperationAcknowledgement>;
  delete(id: string, baseVersion: number): Promise<OperationAcknowledgement>;
  followup(id: string, baseVersion: number, changes: FindingFollowupInput): Promise<OperationAcknowledgement>;
}