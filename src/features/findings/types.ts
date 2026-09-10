import type { EntityTimestamps } from "@/types/entity";

export type FindingPriority = "low" | "medium" | "high";
export type FindingStatus = "pending" | "in_review" | "resolved";

/** First-class entity mandated by ADR-002; it belongs to exactly one inspection. */
export type Finding = EntityTimestamps & {
  id: string;
  inspectionId: string;
  description: string;
  priority: FindingPriority;
  status: FindingStatus;
};

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
