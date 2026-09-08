import type { SyncStatus } from "@/features/inspections";

export type SyncEntityKind = "inspection" | "finding";
export type SyncOperation = "create" | "update" | "delete";

export type SyncQueueItem = {
  id: string;
  entity: SyncEntityKind;
  entityId: string;
  operation: SyncOperation;
  createdAt: string;
  status: Extract<SyncStatus, "pending" | "syncing" | "error">;
};
