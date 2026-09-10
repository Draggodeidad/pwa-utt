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
  recordedAt?: string;
};

export type InspectionEditorValues = {
  id: string;
  folio: string;
  laboratoryCode: string;
  date: string;
  technician: string;
  technicianId: string;
  summary: string;
  findings: InspectionFinding[];
  syncStatus: SyncStatus;
};

export type LaboratoryProfile = {
  code: string;
  label: string;
  building: string;
  floor: string;
  image: string;
  activeStations: string;
  network: string;
  audiovisual: string;
  climate: string;
  protocol: string;
};

export type InspectionDetail = {
  id: string;
  folio: string;
  logbookReference: string;
  location: string;
  laboratoryCode: string;
  building: string;
  floor: string;
  date: string;
  technician: string;
  technicianId: string;
  workflowStatus: InspectionWorkflowStatus;
  result: InspectionResult;
  syncStatus: SyncStatus;
  scope: string;
  createdAt: string;
  updatedAt: string;
  createdDevice: string;
  updatedBy: string;
  nextInspection: string;
  protocol: string;
  evidenceImage: string;
  findings: readonly InspectionFinding[];
};

export type TechnicianHomeData = {
  technicianId: string;
  activeNotebook: string;
  route: { completedRooms: number; totalRooms: number; description: string };
  upcomingStop: { laboratoryCode: string; location: string; description: string; schedule: string; building: string };
};
