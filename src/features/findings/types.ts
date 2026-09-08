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
