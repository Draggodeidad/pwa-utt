import type { SyncQueueItem } from "@/features/sync";
import type { LocalStorage } from "../offline-storage";
import type { Uuid } from "@/types/entity";

export interface SyncQueue {
  enqueue(item: SyncQueueItem): Promise<void>;
  listPending(): Promise<SyncQueueItem[]>;
  markComplete(id: string): Promise<void>;
}

/** Queue bound to one active user partition; never accessible without an owner. */
export class LocalStorageSyncQueue implements SyncQueue {
  private readonly storage: LocalStorage;
  private readonly owner: Uuid;

  constructor(storage: LocalStorage, owner: Uuid) {
    this.storage = storage;
    this.owner = owner;
  }

  enqueue(item: SyncQueueItem): Promise<void> {
    return this.storage.enqueue(this.owner, item);
  }

  listPending(): Promise<SyncQueueItem[]> {
    return this.storage.listPending(this.owner);
  }

  markComplete(id: string): Promise<void> {
    return this.storage.markComplete(this.owner, id);
  }
}

export type RecoveryState = "ready" | "waiting" | "blocked_dependency" | "retry_exhausted" | "intervention";

/** Separates an operation's own terminal error from a dependent waiting on it. */
export function recoveryState(item: SyncQueueItem, queue: readonly SyncQueueItem[], now: number): RecoveryState {
  if (item.retryExhausted) return "retry_exhausted";
  if (item.status === "error" && !item.nextAttemptAt) return "intervention";
  if (item.dependsOn.some((id) => queue.some((other) => other.operationId === id))) return "blocked_dependency";
  if (item.nextAttemptAt && Date.parse(item.nextAttemptAt) > now) return "waiting";
  return "ready";
}
