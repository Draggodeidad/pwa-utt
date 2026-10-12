import type { InspectionDetail, InspectionListItem, InspectionLocation } from "../types";
import type { InspectionDraftInput } from "../schemas/inspection.schema";
import type { OperationAcknowledgement } from "@/features/sync/types";

/** Port implemented by an API-backed or offline-first data source. */
export interface InspectionRepository {
  list(): Promise<InspectionListItem[]>;
  getDetail(id: string): Promise<InspectionDetail | null>;
  create(id: string, draft: InspectionDraftInput): Promise<OperationAcknowledgement>;
  update(id: string, baseVersion: number, draft: InspectionDraftInput): Promise<OperationAcknowledgement>;
  discard(id: string, baseVersion: number): Promise<OperationAcknowledgement>;
  finalize(id: string, baseVersion: number, expectedFindingIds: readonly string[], location?: InspectionLocation | null): Promise<OperationAcknowledgement>;
}