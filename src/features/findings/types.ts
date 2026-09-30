import type { LocalEntityMetadata, RemoteEntity, Uuid } from "../../types/entity";

export type FindingPriority = "low" | "medium" | "high";
export type FindingStatus = "pending" | "in_review" | "resolved";

/** Server entity. Capture and local synchronization state intentionally stay separate. */
export type Finding = RemoteEntity & {
  inspectionId: Uuid;
  title: string;
  description: string;
  priority: FindingPriority;
  status: FindingStatus;
  createdBy: Uuid;
  updatedBy: Uuid;
  resolvedAt: string | null;
  deletedAt: string | null;
};

export type LocalFinding = Finding & LocalEntityMetadata;

/** Snake-case representation used only at the API/database boundary. */
export type FindingApiRecord = {
  id: string;
  inspection_id: string;
  title: string;
  description: string;
  priority: FindingPriority;
  status: FindingStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  resolved_at: string | null;
  deleted_at: string | null;
};

export function findingFromApi(record: FindingApiRecord): Finding {
  return {
    id: record.id,
    inspectionId: record.inspection_id,
    title: record.title,
    description: record.description,
    priority: record.priority,
    status: record.status,
    createdBy: record.created_by,
    updatedBy: record.updated_by,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    version: record.version,
    resolvedAt: record.resolved_at,
    deletedAt: record.deleted_at,
  };
}

export function findingToApi(finding: Finding): FindingApiRecord {
  return {
    id: finding.id,
    inspection_id: finding.inspectionId,
    title: finding.title,
    description: finding.description,
    priority: finding.priority,
    status: finding.status,
    created_by: finding.createdBy,
    updated_by: finding.updatedBy,
    created_at: finding.createdAt,
    updated_at: finding.updatedAt,
    version: finding.version,
    resolved_at: finding.resolvedAt,
    deleted_at: finding.deletedAt,
  };
}

/** Read model used by Coordination to review findings across inspections. */
export type CoordinationFinding = {
  id: string;
  inspectionId: string;
  folio: string;
  title: string;
  description: string;
  laboratory: string;
  date: string;
  technician: string;
  priority: FindingPriority;
  status: FindingStatus;
  evidenceLabel?: string;
  evidenceImage?: string;
  internalNote: string;
};

export type FindingFilters = {
  query: string;
  priority: "all" | FindingPriority;
  status: "all" | FindingStatus;
};

export type CoordinationFindingsState = "loading" | "ready" | "empty" | "error";
