import type { SyncStatus } from "@/features/inspections";

export type SyncEntityKind = "inspection" | "finding";
export type SyncOperation = "create" | "update" | "delete";
export type SyncViewState = "loading" | "offline" | "idle" | "syncing" | "success" | "error" | "empty";
export type SyncQueueRecordStatus = "pending" | "syncing" | "error";

export type SyncQueueItem = {
  id: string;
  entity: SyncEntityKind;
  entityId: string;
  operation: SyncOperation;
  createdAt: string;
  status: Extract<SyncStatus, "pending" | "syncing" | "error">;
};

/** Read model for the technician's local inspection queue. */
export type SyncQueueRecord = {
  id: string;
  folio: string;
  laboratory: string;
  date: string;
  status: SyncQueueRecordStatus;
};
