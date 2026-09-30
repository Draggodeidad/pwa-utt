"use client";

import { useEffect, useRef, useState } from "react";
import { getConnectivityState } from "@/lib/pwa/connectivity";
import { isSessionCurrent, sessionEpoch } from "@/lib/pwa/offline-session";
import { initialLastSyncAt, initialSyncQueue } from "../data/sync-queue";
import type { SyncQueueRecord, SyncViewState } from "../types";

function stateForQueue(queue: readonly SyncQueueRecord[]): SyncViewState {
  if (queue.length === 0) return "empty";
  return queue.some((record) => record.status === "error") ? "error" : "idle";
}

/** Client-side visual flow until the persistent queue and sync transport are available. */
export function useSyncWorkspace() {
  const [state, setState] = useState<SyncViewState>("loading");
  const [queue, setQueue] = useState<SyncQueueRecord[]>([...initialSyncQueue]);
  const [lastSyncAt, setLastSyncAt] = useState(initialLastSyncAt);
  const [progress, setProgress] = useState(0);
  const timeoutIds = useRef<number[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const schedule = (callback: () => void, delay: number) => {
    const epoch = sessionEpoch();
    const timeoutId = window.setTimeout(() => { if (isSessionCurrent(epoch)) callback(); }, delay);
    timeoutIds.current.push(timeoutId);
  };

  useEffect(() => {
    const epoch = sessionEpoch();
    const lock = () => {
      if (!isSessionCurrent(epoch)) {
        timeoutIds.current.forEach((id) => window.clearTimeout(id));
        setQueue([]);
        setProgress(0);
        setLastSyncAt("");
        setState("empty");
      }
    };
    const updateConnectivity = () => {
      if (getConnectivityState() === "offline") {
        setState("offline");
        return;
      }

      setState((current) => current === "offline" ? stateForQueue(queueRef.current) : current);
    };
    const initialize = window.setTimeout(() => {
      setState(getConnectivityState() === "offline" ? "offline" : stateForQueue(queueRef.current));
    }, 300);

    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    window.addEventListener("pwa-utt:session-changed", lock);
    window.addEventListener("storage", lock);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
      window.removeEventListener("pwa-utt:session-changed", lock);
      window.removeEventListener("storage", lock);
      timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  const completeSync = () => {
    setQueue([]);
    setLastSyncAt(new Date().toISOString());
    setProgress(100);
    setState("success");
    schedule(() => setState("empty"), 1800);
  };

  const syncNow = () => {
    if (!isSessionCurrent(sessionEpoch()) || state === "offline" || state === "syncing" || queue.length === 0) return;

    window.dispatchEvent(new Event("pwa-utt:sync-now"));
    setState("syncing");
    setProgress(0);
    setQueue((current) => current.map((record) => ({ ...record, status: "syncing" })));
    schedule(() => setProgress(34), 250);
    schedule(() => setProgress(67), 500);
    schedule(completeSync, 750);
  };

  const retry = (id: string) => {
    if (!isSessionCurrent(sessionEpoch()) || state === "offline" || state === "syncing") return;

    const remainingQueue = queue.filter((record) => record.id !== id);
    setState("syncing");
    setProgress(0);
    setQueue((current) => current.map((record) => record.id === id ? { ...record, status: "syncing" } : record));
    schedule(() => setProgress(50), 250);
    schedule(() => {
      setQueue(remainingQueue);
      setState(stateForQueue(remainingQueue));
      setLastSyncAt(new Date().toISOString());
      setProgress(100);
    }, 550);
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
