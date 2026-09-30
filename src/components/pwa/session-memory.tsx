"use client";

import { useEffect } from "react";
import { clearLocalSession, rememberLocalSession } from "@/lib/pwa/offline-session";
import { runBrowserQueue } from "@/lib/pwa/sync/browser-runner";

/** Persists the active user locally so the offline shell can open their partition. */
export function SessionMemory() {
  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) {
          const body = await response.json() as { user?: { id?: string; displayName?: string } };
          if (body.user?.id) {
            rememberLocalSession({ userId: body.user.id, displayName: body.user.displayName ?? "" });
          } else {
            clearLocalSession();
          }
        } else {
          clearLocalSession();
        }
      })
      .catch(() => { /* offline: keep the last remembered session */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const run = () => { void runBrowserQueue().catch(() => { /* keep durable queue for next open */ }); };
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    run();
    window.addEventListener("online", run);
    window.addEventListener("pwa-utt:queue-changed", run);
    window.addEventListener("pwa-utt:sync-now", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener("pwa-utt:queue-changed", run);
      window.removeEventListener("pwa-utt:sync-now", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
