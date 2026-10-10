import type { SyncCompletedNotificationDetail } from "./contracts.ts";

/** A fresh durable ACK and a fully settled queue are required, not just an empty queue. */
export function confirmedSyncCompletion(input: {
  owner: string;
  epoch: string;
  lastAcknowledgedId: string | null;
  outcome: { acknowledged: number; failed: number; paused: boolean };
  pendingCount: number;
  unresolvedConflicts: number;
  sessionCurrent: boolean;
  updatePaused: boolean;
}): SyncCompletedNotificationDetail | null {
  if (!input.lastAcknowledgedId || input.outcome.acknowledged < 1 || input.outcome.failed > 0 ||
    input.outcome.paused || input.updatePaused || !input.sessionCurrent ||
    input.pendingCount > 0 || input.unresolvedConflicts > 0) return null;
  return {
    owner: input.owner,
    epoch: input.epoch,
    event: {
      id: `${input.owner}:${input.lastAcknowledgedId}`,
      kind: "sync-completed",
      title: "Sincronización completada",
      body: "Los cambios pendientes se confirmaron correctamente.",
    },
  };
}
