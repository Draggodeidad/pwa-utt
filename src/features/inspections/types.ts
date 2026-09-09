import type { EntityTimestamps } from "@/types/entity";

export type InspectionWorkflowStatus = "draft" | "completed";
export type InspectionResult = "without_findings" | "requires_attention";
export type SyncStatus = "local" | "pending" | "syncing" | "synced" | "error";

/** Canonical inspection entity. Its result is derived from related findings. */
export type Inspection = EntityTimestamps & {
  id: string;
  location: string;
  date: string;
  inspectorId: string;
  summary: string;
  workflowStatus: InspectionWorkflowStatus;
  syncStatus: SyncStatus;
};

/** Read model for list cards; findingCount comes from the finding relation/query. */
export type InspectionListItem = Pick<Inspection, "id" | "location" | "date" | "summary" | "syncStatus"> & {
  inspector: string;
  laboratoryCode: string;
  workflowStatus: InspectionWorkflowStatus;
  findingCount: number;
  result: InspectionResult;
};
