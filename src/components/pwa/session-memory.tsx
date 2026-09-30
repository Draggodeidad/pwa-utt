"use client";

import { useEffect } from "react";
import { clearLocalSession, rememberLocalSession } from "@/lib/pwa/offline-session";

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

  return null;
}