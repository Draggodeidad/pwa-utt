"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearLocalSession, isSessionBlocked, isSessionCurrent, rememberLocalSession, sessionEpoch } from "@/lib/pwa/offline-session";
import { runBrowserQueue } from "@/lib/pwa/sync/browser-runner";

/** Persists the active user locally so the offline shell can open their partition. */
export function SessionMemory() {
  const router = useRouter();
  const pathname = usePathname();
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let active = true;
    const epoch = sessionEpoch();
    fetch("/api/session", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!active || !isSessionCurrent(epoch)) return;
        if (response.ok) {
          const body = await response.json() as { user?: { id?: string; displayName?: string } };
          if (!active || !isSessionCurrent(epoch)) return;
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
    const onSessionChange = () => {
      const locked = isSessionBlocked();
      setBlocked(locked);
      if (locked) { router.replace("/login"); router.refresh(); }
      else run();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "pwa-utt:session-gate" || event.key === "pwa-utt:active-session") onSessionChange();
    };
    setBlocked(isSessionBlocked());
    run();
    window.addEventListener("online", run);
    window.addEventListener("pwa-utt:queue-changed", run);
    window.addEventListener("pwa-utt:sync-now", run);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pwa-utt:session-changed", onSessionChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener("pwa-utt:queue-changed", run);
      window.removeEventListener("pwa-utt:sync-now", run);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pwa-utt:session-changed", onSessionChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [router]);

  if (!blocked || pathname === "/login") return null;
  return <div className={s.lock} role="alert"><div className={s.lockCard}><h1 className={s.lockTitle}>Sesión cerrada</h1><p>Inicia sesión en línea para volver a acceder a tus datos.</p><a className={s.lockLink} href="/login">Ir a iniciar sesión</a></div></div>;
}

const s = {
  lock: "fixed inset-0 z-50 grid place-items-center bg-background p-6",
  lockCard: "max-w-md space-y-3 rounded-sm border bg-card p-6 text-center shadow-sm",
  lockTitle: "text-xl font-semibold",
  lockLink: "inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
};
