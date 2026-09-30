import type { Inspection, InspectionDetailDto, InspectionListDto } from "../types";
import type { InspectionDraftInput } from "../schemas/inspection.schema";
import type { OperationAcknowledgement } from "@/features/sync/types";

/** Port implemented later by an API-backed or offline-first data source. */
export interface InspectionRepository {
  list(): Promise<InspectionListDto[]>;
  getById(id: string): Promise<Inspection | null>;
  getDetail(id: string): Promise<InspectionDetailDto | null>;
  create(id: string, draft: InspectionDraftInput): Promise<OperationAcknowledgement>;
  update(id: string, baseVersion: number, draft: InspectionDraftInput): Promise<OperationAcknowledgement>;
  discard(id: string, baseVersion: number): Promise<OperationAcknowledgement>;
  finalize(id: string, baseVersion: number, expectedFindingIds: readonly string[]): Promise<OperationAcknowledgement>;
}
