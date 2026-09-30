"use client";

import { useCallback, useEffect, useState } from "react";
import { getConnectivityState } from "@/lib/pwa/connectivity";
import { isSessionCurrent, readLocalSession, sessionEpoch } from "@/lib/pwa/offline-session";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { isBrowserQueueRunning } from "@/lib/pwa/sync/browser-runner";
import type { SyncStatus } from "@/types/entity";

export type GlobalSyncState = {
  status: SyncStatus;
  pendingCount: number;
  errorCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  isOffline: boolean;
};

export function useSyncStatus(): GlobalSyncState {
  const [state, setState] = useState<GlobalSyncState>({
    status: "synced",
    pendingCount: 0,
    errorCount: 0,
    isSyncing: false,
    lastSyncAt: null,
    isOffline: false,
  });

  const update = useCallback(async () => {
    const isOffline = getConnectivityState() === "offline";
    const epoch = sessionEpoch();
    const session = readLocalSession();

    if (!session || !isSessionCurrent(epoch, session.userId)) {
      setState({
        status: "synced",
        pendingCount: 0,
        errorCount: 0,
        isSyncing: false,
        lastSyncAt: null,
        isOffline,
      });
      return;
    }

    try {
      const storage = await LocalStorage.open();
      try {
        if (!isSessionCurrent(epoch, session.userId)) return;

        const [queue, conflicts, inspections, lastSyncAt] = await Promise.all([
          storage.listQueue(session.userId),
          storage.listConflicts(session.userId),
          storage.listInspections(session.userId),
          storage.getLastSyncAt(session.userId),
        ]);

        if (!isSessionCurrent(epoch, session.userId)) return;

        const unresolvedConflicts = conflicts.filter((c) => !c.resolvedAt).length;
        const queueErrors = queue.filter((i) => i.status === "error").length;
        const errorCount = queueErrors + unresolvedConflicts;
        const pendingCount = queue.length;
        const hasLocalOnly = inspections.some((i) => i.syncStatus === "local");
        const syncing = isBrowserQueueRunning() || queue.some((i) => i.status === "syncing");

        let status: SyncStatus = "synced";
        if (syncing) {
          status = "syncing";
        } else if (errorCount > 0) {
          status = "error";
        } else if (pendingCount > 0) {
          status = "pending";
        } else if (hasLocalOnly) {
          status = "local";
        } else {
          status = "synced";
        }

        setState({
          status,
          pendingCount,
          errorCount,
          isSyncing: syncing,
          lastSyncAt,
          isOffline,
        });
      } finally {
        storage.close();
      }
    } catch {
      setState((current) => ({ ...current, isOffline }));
    }
  }, []);

  useEffect(() => {
    void update();

    const onQueueChanged = () => { void update(); };
    const onConnectivity = () => { void update(); };
    const onSyncStatus = () => { void update(); };
    const onSessionChanged = () => { void update(); };

    window.addEventListener("online", onConnectivity);
    window.addEventListener("offline", onConnectivity);
    window.addEventListener("pwa-utt:queue-changed", onQueueChanged);
    window.addEventListener("pwa-utt:sync-status", onSyncStatus);
    window.addEventListener("pwa-utt:session-changed", onSessionChanged);
    window.addEventListener("storage", onSessionChanged);

    return () => {
      window.removeEventListener("online", onConnectivity);
      window.removeEventListener("offline", onConnectivity);
      window.removeEventListener("pwa-utt:queue-changed", onQueueChanged);
      window.removeEventListener("pwa-utt:sync-status", onSyncStatus);
      window.removeEventListener("pwa-utt:session-changed", onSessionChanged);
      window.removeEventListener("storage", onSessionChanged);
    };
  }, [update]);

  return state;
}
