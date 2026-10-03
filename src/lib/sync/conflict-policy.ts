// W05 contract path: one conflict policy for detection and manual resolution.
export { inspectConflict } from "../../features/sync/services/conflict-detection.ts";
export type { ConflictEvidence } from "../../features/sync/services/conflict-detection.ts";
export { resolveConflict, ConflictResolutionError } from "../../features/sync/services/resolve-conflict.ts";
export type { ConflictReason, ConflictRecord } from "../../features/sync/types.ts";
