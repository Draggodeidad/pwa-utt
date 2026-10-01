import { ApiClientError } from "../../../lib/api/client.ts";
import type { ApiClient } from "../../../lib/api/client.ts";
import type { ConflictReason, SyncQueueItem } from "../types.ts";

export type ConflictEvidence = { reason: ConflictReason; remoteSnapshot: unknown | null; remoteVersion: number | null };

/** Only an authorized GET may supply remote evidence; an error body is never a snapshot. */
export async function inspectConflict(client: ApiClient, sent: SyncQueueItem, error: unknown): Promise<ConflictEvidence | null> {
  if (!(error instanceof ApiClientError) || ![403, 404, 409].includes(error.status)) return null;
  if (error.status !== 409) return { reason: "inaccessible", remoteSnapshot: null, remoteVersion: null };
  if (error.payload.code === "IDEMPOTENCY_KEY_REUSED") return { reason: "key_reused", remoteSnapshot: null, remoteVersion: null };
  if (error.payload.code === "ENTITY_ID_REUSED") return { reason: "entity_reused", remoteSnapshot: null, remoteVersion: null };

  const initialReason: ConflictReason = error.payload.code === "FINDING_SET_CONFLICT" ? "finding_set"
    : error.payload.code === "VERSION_CONFLICT" ? "version" : "unknown";
  const path = sent.entity === "inspection" ? `/api/inspections/${sent.entityId}` : `/api/findings/${sent.entityId}`;
  try {
    const snapshot = await client.get<unknown>(path);
    if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) return { reason: initialReason, remoteSnapshot: null, remoteVersion: null };
    const entity = snapshot as Record<string, unknown>;
    if (entity.id !== sent.entityId || typeof entity.version !== "number" || !Number.isSafeInteger(entity.version) || entity.version < 1) return { reason: initialReason, remoteSnapshot: null, remoteVersion: null };
    const captureOperation = sent.operation !== "finding.followup";
    const reason = captureOperation && entity.workflowStatus === "completed" && initialReason !== "finding_set" ? "state" : initialReason;
    return { reason, remoteSnapshot: snapshot, remoteVersion: entity.version };
  } catch {
    return { reason: initialReason, remoteSnapshot: null, remoteVersion: null };
  }
}
