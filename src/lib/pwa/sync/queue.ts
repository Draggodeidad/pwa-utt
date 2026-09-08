import type { SyncQueueItem } from "@/features/sync";

export interface SyncQueue {
  enqueue(item: SyncQueueItem): Promise<void>;
  listPending(): Promise<SyncQueueItem[]>;
  markComplete(id: string): Promise<void>;
}
