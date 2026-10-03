// W05 contract path: reuse the durable queue and transport already used by the app.
export { LocalStorageSyncQueue, recoveryState } from "../pwa/sync/queue.ts";
export type { SyncQueue, RecoveryState } from "../pwa/sync/queue.ts";
export { operationRoute, sendOperation, runQueue } from "../pwa/sync/runner.ts";
export type { QueueTransport } from "../pwa/sync/runner.ts";
