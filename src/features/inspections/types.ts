import type { Finding, FindingPriority, FindingStatus } from "../findings/types";
import type { LocalEntityMetadata, RemoteEntity, SyncStatus, Uuid } from "../../types/entity";

export type InspectionWorkflowStatus = "draft" | "completed";
export type InspectionResult = "without_findings" | "requires_attention";
export type { SyncStatus } from "../../types/entity";

/** Server entity. The result and all device metadata are deliberately absent. */
export type Inspection = RemoteEntity & {
  folioNumber: number;
  laboratoryId: Uuid | null;
  inspectorId: Uuid;
  inspectionDate: string | null;
  summary: string;
  workflowStatus: InspectionWorkflowStatus;
  updatedBy: Uuid;
  completedAt: string | null;
  deletedAt: string | null;
};

export type LocalInspection = Inspection & LocalEntityMetadata;

/** Snake-case representation used only at the API/database boundary. */
export type InspectionApiRecord = {
  id: string;
  folio_number: number;
  laboratory_id: string | null;
  inspector_id: string;
  inspection_date: string | null;
  summary: string;
  workflow_status: InspectionWorkflowStatus;
  updated_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  completed_at: string | null;
  deleted_at: string | null;
};

export function inspectionFromApi(record: InspectionApiRecord): Inspection {
  return {
    id: record.id,
    folioNumber: record.folio_number,
    laboratoryId: record.laboratory_id,
    inspectorId: record.inspector_id,
    inspectionDate: record.inspection_date,
    summary: record.summary,
    workflowStatus: record.workflow_status,
    updatedBy: record.updated_by,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    version: record.version,
    completedAt: record.completed_at,
    deletedAt: record.deleted_at,
  };
}

export function inspectionToApi(inspection: Inspection): InspectionApiRecord {
  return {
    id: inspection.id,
    folio_number: inspection.folioNumber,
    laboratory_id: inspection.laboratoryId,
    inspector_id: inspection.inspectorId,
    inspection_date: inspection.inspectionDate,
    summary: inspection.summary,
    workflow_status: inspection.workflowStatus,
    updated_by: inspection.updatedBy,
    created_at: inspection.createdAt,
    updated_at: inspection.updatedAt,
    version: inspection.version,
    completed_at: inspection.completedAt,
    deleted_at: inspection.deletedAt,
  };
}

export type InspectionFinding = {
  id: string;
  priority: FindingPriority;
  status: FindingStatus;
  title: string;
  description: string;
  version?: number | null;
  evidenceLabel?: string;
  evidenceImage?: string;
  evidenceCount?: number;
};

export type InspectionListDto = {
  id: string;
  folio: string;
  folioNumber: number;
  laboratoryId: string | null;
  location: string;
  laboratoryCode: string;
  inspectorId: string;
  inspector: string;
  inspectionDate: string | null;
  date: string;
  summary: string;
  workflowStatus: InspectionWorkflowStatus;
  result: InspectionResult;
  findingCount: number;
  pendingFindingCount: number;
  version: number;
  syncStatus: SyncStatus;
};

/** Temporary UI-compatible list shape. New data enters through InspectionListDto. */
export type InspectionListItem = Pick<InspectionListDto, "id" | "location" | "date" | "summary" | "syncStatus" | "inspector" | "laboratoryCode" | "workflowStatus" | "findingCount" | "pendingFindingCount" | "result">;

export type InspectionEditorDto = {
  id: string;
  folio: string;
  folioNumber: number;
  laboratoryId: string | null;
  laboratoryCode: string;
  inspectionDate: string | null;
  date: string;
  inspectorId: string;
  technician: string;
  summary: string;
  workflowStatus: InspectionWorkflowStatus;
  version: number;
  findings: readonly InspectionFinding[];
  syncStatus: SyncStatus;
};

/** Existing editor props remain stable while fixtures are migrated through explicit adapters. */
export type InspectionEditorValues = Omit<InspectionEditorDto, "folioNumber" | "laboratoryId" | "inspectionDate" | "inspectorId" | "workflowStatus" | "version"> & { version: number | null };

export type InspectionDetailDto = {
  id: string;
  folio: string;
  folioNumber: number;
  location: string;
  laboratoryCode: string;
  laboratoryId: string | null;
  inspectionDate: string | null;
  date: string;
  inspectorId: string;
  technician: string;
  workflowStatus: InspectionWorkflowStatus;
  result: InspectionResult;
  findingCount: number;
  pendingFindingCount: number;
  version: number;
  syncStatus: SyncStatus;
  scope: string;
  findings: readonly InspectionFinding[];
};

/** Temporary UI-compatible detail shape. New data enters through InspectionDetailDto. */
export type InspectionDetail = Pick<InspectionDetailDto, "id" | "folio" | "location" | "date" | "technician" | "workflowStatus" | "result" | "syncStatus" | "scope" | "findings" | "version"> & Partial<Pick<InspectionDetailDto, "folioNumber" | "laboratoryId" | "laboratoryCode" | "inspectionDate">>;

export type LaboratoryProfile = {
  code: string;
  label: string;
  building: string;
  floor: string;
};

/** Authorized catalog entry served by GET /api/laboratories. */
export type LaboratoryOption = {
  id: string;
  code: string;
  name: string;
};

export type InspectionAggregate = {
  inspection: Inspection;
  findings: readonly Finding[];
  laboratory: { code: string; label: string } | null;
  inspectorName: string;
  local: Pick<LocalEntityMetadata, "syncStatus">;
};
