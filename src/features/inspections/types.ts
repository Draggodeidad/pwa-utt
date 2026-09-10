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

export type InspectionFinding = {
  id: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_review" | "resolved";
  title: string;
  description: string;
  evidenceLabel?: string;
  evidenceImage?: string;
  evidenceCount?: number;
};

export type InspectionEditorValues = {
  id: string;
  folio: string;
  laboratoryCode: string;
  date: string;
  technician: string;
  summary: string;
  findings: InspectionFinding[];
  syncStatus: SyncStatus;
};

export type LaboratoryProfile = {
  code: string;
  label: string;
  building: string;
  floor: string;
};

export type InspectionDetail = {
  id: string;
  folio: string;
  location: string;
  date: string;
  technician: string;
  workflowStatus: InspectionWorkflowStatus;
  result: InspectionResult;
  syncStatus: SyncStatus;
  scope: string;
  findings: readonly InspectionFinding[];
};
