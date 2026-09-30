"use client";

import { useCallback, useEffect, useState } from "react";

export type OfflineReadinessState = "checking" | "ready" | "not-ready";

const readyTimers = new Set<ReturnType<typeof setTimeout>>();

function waitForServiceWorker(): Promise<ServiceWorker | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      resolve(null);
      return;
    }
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      resolve(controller);
      return;
    }
    navigator.serviceWorker.ready
      .then((registration) => resolve(registration.active))
      .catch(() => resolve(null));
  });
}

function askReadiness(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 3000);
    readyTimers.add(timeout);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_READY_STATE" && typeof event.data.ready === "boolean") {
        clearTimeout(timeout);
        readyTimers.delete(timeout);
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve(event.data.ready);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    try {
      worker.postMessage({ type: "READY_QUERY" });
    } catch {
      clearTimeout(timeout);
      readyTimers.delete(timeout);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      resolve(false);
    }
  });
}

async function checkStorage(): Promise<boolean> {
  try {
    const request = indexedDB.open("pwa-utt-local");
    const opened = await new Promise<boolean>((resolve) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
    if (opened && request.result) request.result.close();
    return opened;
  } catch {
    return false;
  }
}

/**
 * Reports offline readiness only after verifying the service worker is in
 * control, the essential shell/assets are cached and IndexedDB is available.
 */
export function useOfflineReadiness(): OfflineReadinessState {
  const [state, setState] = useState<OfflineReadinessState>("checking");

  const refresh = useCallback(async () => {
    setState("checking");
    const worker = await waitForServiceWorker();
    if (!worker) {
      setState("not-ready");
      return;
    }
    const [assetsReady, storageReady] = await Promise.all([askReadiness(worker), checkStorage()]);
    setState(assetsReady && storageReady ? "ready" : "not-ready");
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onReady = () => void refresh();
    navigator.serviceWorker.addEventListener("message", onReady);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onReady);
      readyTimers.forEach((timer) => clearTimeout(timer));
      readyTimers.clear();
    };
  }, [refresh]);

  return state;
}