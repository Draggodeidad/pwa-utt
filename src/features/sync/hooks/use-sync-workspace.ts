"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getConnectivityState } from "@/lib/pwa/connectivity";
import { isSessionCurrent, readLocalSession, sessionEpoch } from "@/lib/pwa/offline-session";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { isPwaUpdatePreparing, trackPwaMutation } from "@/lib/pwa/update-coordination";
import { isBrowserQueueRunning, runBrowserQueue } from "@/lib/pwa/sync/browser-runner";
import type { SyncQueueRecord, SyncViewState } from "../types";

export function useSyncWorkspace() {
  const [state, setState] = useState<SyncViewState>("loading");
  const [queue, setQueue] = useState<SyncQueueRecord[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string>("");
  const [progress, setProgress] = useState(0);

  const initialBatchCountRef = useRef(0);
  const acknowledgedInRunRef = useRef(0);

  const reload = useCallback(async () => {
    const epoch = sessionEpoch();
    const session = readLocalSession();
    if (!session || !isSessionCurrent(epoch, session.userId)) {
      setQueue([]);
      setLastSyncAt("");
      setProgress(0);
      setState("empty");
      return;
    }

    try {
      const storage = await LocalStorage.open();
      try {
        if (!isSessionCurrent(epoch, session.userId)) return;
        const [items, conflicts, lastSync, catalog, inspections, findings] = await Promise.all([
          storage.listQueue(session.userId),
          storage.listConflicts(session.userId),
          storage.getLastSyncAt(session.userId),
          storage.getCatalog(session.userId),
          storage.listInspections(session.userId),
          storage.listFindings(session.userId),
        ]);

        if (!isSessionCurrent(epoch, session.userId)) return;

        const labMap = new Map(catalog.map((c) => [c.id, c.name]));
        const inspMap = new Map(inspections.map((i) => [i.id, i]));
        const findMap = new Map(findings.map((f) => [f.id, f]));
        const openConflicts = conflicts.filter((c) => !c.resolvedAt);

        const mapped: SyncQueueRecord[] = items.map((item) => {
          const hasConflict = openConflicts.some(
            (c) => c.operationId === item.operationId || c.entityId === item.entityId
          );
          const blockedByDependency = item.dependsOn.some((depId) =>
            items.some((other) => other.operationId === depId)
          );

          if (item.entity === "inspection") {
            const local = inspMap.get(item.entityId);
            const folio = local?.folioNumber ? `INS-${local.folioNumber}` : "—";
            const laboratory = (local?.laboratoryId ? labMap.get(local.laboratoryId) : undefined) ?? (local?.summary ? local.summary.slice(0, 30) : "Inspección");
            const date = local?.inspectionDate || (local?.createdAt ? local.createdAt.slice(0, 10) : "");
            return {
              id: item.operationId,
              folio,
              laboratory,
              date,
              status: item.status,
              entity: item.entity,
              operation: item.operation,
              attempts: item.attempts,
              nextAttemptAt: item.nextAttemptAt,
              lastError: item.lastError,
              retryExhausted: Boolean(item.retryExhausted),
              blockedByDependency,
              hasConflict,
            };
          }

          const localFinding = findMap.get(item.entityId);
          const parentId = localFinding?.inspectionId ?? item.parentEntityId;
          const parent = parentId ? inspMap.get(parentId) : undefined;
          const folio = parent?.folioNumber ? `INS-${parent.folioNumber}` : "—";
          const laboratory = localFinding?.title || ((parent?.laboratoryId ? labMap.get(parent.laboratoryId) : undefined) ?? "Hallazgo");
          const date = parent?.inspectionDate || (localFinding?.createdAt ? localFinding.createdAt.slice(0, 10) : "");
          return {
            id: item.operationId,
            folio,
            laboratory,
            date,
            status: item.status,
            entity: item.entity,
            operation: item.operation,
            attempts: item.attempts,
            nextAttemptAt: item.nextAttemptAt,
            lastError: item.lastError,
            retryExhausted: Boolean(item.retryExhausted),
            blockedByDependency,
            hasConflict,
          };
        });

        setQueue(mapped);
        setLastSyncAt(lastSync ?? "");

        if (getConnectivityState() === "offline") {
          setState("offline");
        } else if (isBrowserQueueRunning()) {
          setState("syncing");
        } else if (mapped.length === 0) {
          setState("empty");
        } else if (mapped.some((r) => r.status === "error" || r.hasConflict)) {
          setState("error");
        } else {
          setState("idle");
        }
      } finally {
        storage.close();
      }
    } catch {
      if (isSessionCurrent(epoch)) {
        setState("empty");
        setQueue([]);
      }
    }
  }, []);

  useEffect(() => {
    void reload();

    const onQueueChanged = () => { void reload(); };
    const onConnectivity = () => {
      if (getConnectivityState() === "offline") {
        setState("offline");
      } else {
        void reload();
      }
    };
    const onSessionChanged = () => {
      const epoch = sessionEpoch();
      const session = readLocalSession();
      if (!session || !isSessionCurrent(epoch, session.userId)) {
        setQueue([]);
        setLastSyncAt("");
        setProgress(0);
        setState("empty");
      } else {
        void reload();
      }
    };
    const onSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ running: boolean; outcome?: { acknowledged: number; failed: number } }>).detail;
      if (detail?.running) {
        setState("syncing");
        if (detail.outcome) {
          acknowledgedInRunRef.current += detail.outcome.acknowledged;
          if (initialBatchCountRef.current > 0) {
            const pct = Math.min(100, Math.round((acknowledgedInRunRef.current / initialBatchCountRef.current) * 100));
            setProgress(pct);
          }
        }
      } else {
        void reload();
      }
    };

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
  }, [reload]);

  const syncNow = async () => {
    const epoch = sessionEpoch();
    const session = readLocalSession();
    if (!session || !isSessionCurrent(epoch, session.userId) || isBrowserQueueRunning() || getConnectivityState() === "offline" || queue.length === 0) return;

    initialBatchCountRef.current = queue.length;
    acknowledgedInRunRef.current = 0;
    setProgress(0);
    setState("syncing");
    window.dispatchEvent(new Event("pwa-utt:sync-now"));
    try {
      await runBrowserQueue();
    } catch {
      // Runner preserves durable state
    }
  };

  const retry = async (operationId: string) => {
    if (isPwaUpdatePreparing()) return;
    const epoch = sessionEpoch();
    const session = readLocalSession();
    if (!session || !isSessionCurrent(epoch, session.userId) || isBrowserQueueRunning()) return;

    const storage = await LocalStorage.open();
    try {
      const retried = await trackPwaMutation(() => storage.retryQueueItem(session.userId, operationId));
      if (retried) {
        initialBatchCountRef.current = queue.length;
        acknowledgedInRunRef.current = 0;
        setProgress(0);
        window.dispatchEvent(new Event("pwa-utt:sync-now"));
        try {
          await runBrowserQueue();
        } catch {
          // durable
        }
      }
    } finally {
      storage.close();
    }
  };

  return {
    state,
    queue,
    lastSyncAt,
    progress,
    syncNow,
    retry,
  };
}
