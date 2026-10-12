"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createNotificationsClient } from "@/lib/notifications/client";
import { createBrowserNotificationApi } from "@/lib/notifications/browser";
import { SYNC_COMPLETED_EVENT } from "@/lib/notifications/contracts";
import type { NotificationsClient, SyncCompletedNotificationDetail } from "@/lib/notifications/contracts";
import { isSessionCurrent, readLocalSession, sessionEpoch } from "@/lib/pwa/offline-session";

type Scope = {
  owner: string; epoch: string; enabled: boolean; requestId: number;
  seen: Set<string>; client: NotificationsClient | null;
};
type Controls = { enabled: boolean; busy: boolean; message: string; activate: () => void; deactivate: () => void };
const NotificationsContext = createContext<Controls | null>(null);
const initialMessage = "Los avisos dentro de la app están disponibles. Los avisos del sistema son opcionales y se activan sólo para esta sesión.";
const permissionMessages: Record<string, string> = {
  "permission-denied": "Permiso denegado. Recibirás los avisos dentro de la app.",
  "permission-default": "Permiso sin conceder. Recibirás los avisos dentro de la app.",
  "api-unavailable": "Este navegador no ofrece notificaciones del sistema. Los avisos aparecerán dentro de la app.",
  "insecure-context": "Los avisos del sistema requieren una conexión segura. Los avisos dentro de la app siguen disponibles.",
  "notification-failed": "No se pudo mostrar el aviso del sistema. El aviso sigue disponible dentro de la app.",
};

export function SyncNotificationsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [notice, setNotice] = useState("");
  const scopeRef = useRef<Scope | null>(null);
  function reset() {
    scopeRef.current = null;
    setEnabled(false);
    setBusy(false);
    setMessage(initialMessage);
    setNotice("");
  }
  function scopeForSession(): Scope | null {
    const owner = readLocalSession()?.userId;
    const epoch = sessionEpoch();
    if (!owner || !isSessionCurrent(epoch, owner)) { reset(); return null; }
    const previous = scopeRef.current;
    if (previous?.owner === owner && previous.epoch === epoch) return previous;
    reset();
    const scope: Scope = { owner, epoch, enabled: false, requestId: 0, seen: new Set(), client: null };
    scopeRef.current = scope;
    return scope;
  }
  function current(scope: Scope): boolean {
    return scopeRef.current === scope && isSessionCurrent(scope.epoch, scope.owner);
  }
  function clientFor(scope: Scope): NotificationsClient {
    if (!scope.client) scope.client = createNotificationsClient({
      isSecureContext: () => window.isSecureContext,
      api: createBrowserNotificationApi(() => current(scope) && scope.enabled),
      now: Date.now,
      presentFallback: event => { if (current(scope)) setNotice(event.title + ". " + event.body); },
    });
    return scope.client;
  }
  const activate = () => {
    const scope = scopeForSession();
    if (!scope) { setMessage("Inicia sesión para activar avisos del sistema."); return; }
    const id = ++scope.requestId;
    setBusy(true);
    // Invoke synchronously from the click, preserving the browser's user gesture.
    void clientFor(scope).requestPermission().then(result => {
      if (!current(scope) || id !== scope.requestId) return;
      setBusy(false);
      scope.enabled = result.status === "success" && result.value === "granted";
      setEnabled(scope.enabled);
      setMessage(scope.enabled ? "Avisos del sistema activados hasta recargar o cerrar sesión." : permissionMessages[result.status === "success" ? "permission-default" : result.code]);
    });
  };
  const deactivate = () => {
    const scope = scopeForSession();
    if (scope) { scope.enabled = false; scope.requestId++; }
    setEnabled(false);
    setBusy(false);
    setMessage("Avisos del sistema desactivados. Los avisos dentro de la app siguen disponibles.");
  };
  useEffect(() => {
    const sessionChanged = () => { reset(); };
    const storageChanged = (event: StorageEvent) => {
      if (!event.key || event.key === "pwa-utt:active-session" || event.key === "pwa-utt:session-gate") reset();
    };
    const completed = (event: Event) => {
      const detail = (event as CustomEvent<SyncCompletedNotificationDetail>).detail;
      const scope = scopeForSession();
      if (!scope || !detail || detail.owner !== scope.owner || detail.epoch !== scope.epoch ||
        detail.event?.kind !== "sync-completed" || !current(scope) || scope.seen.has(detail.event.id)) return;
      scope.seen.add(detail.event.id);
      setNotice(detail.event.title + ". " + detail.event.body);
      if (scope.enabled) void clientFor(scope).showConfirmed(detail.event).then(result => {
        if (current(scope) && scope.enabled && result.status !== "success") setMessage(permissionMessages[result.code] ?? permissionMessages["notification-failed"]);
      });
    };
    window.addEventListener(SYNC_COMPLETED_EVENT, completed);
    window.addEventListener("pwa-utt:session-changed", sessionChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      scopeRef.current = null;
      window.removeEventListener(SYNC_COMPLETED_EVENT, completed);
      window.removeEventListener("pwa-utt:session-changed", sessionChanged);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);
  return (
    <NotificationsContext.Provider value={{ enabled, busy, message, activate, deactivate }}>
      {notice ? (
        <div className={s.notice}>
          <p role="status" aria-live="polite" className={s.noticeText}>{notice}</p>
          <Button type="button" variant="ghost" className={s.button} onClick={() => setNotice("")}>Cerrar aviso</Button>
        </div>
      ) : null}
      {children}
    </NotificationsContext.Provider>
  );
}

export function SyncNotificationControls() {
  const controls = useContext(NotificationsContext);
  if (!controls) return null;
  return (
    <Card className={s.controls}>
      <h2 className={s.title}>Avisos de sincronización</h2>
      <p role="status" aria-live="polite" className={s.description}>{controls.message}</p>
      <div className={s.actions}>
        {!controls.enabled ? <Button type="button" variant="outline" className={s.button} disabled={controls.busy} onClick={controls.activate}>
          {controls.busy ? "Solicitando permiso…" : "Activar avisos de sincronización"}
        </Button> : null}
        {controls.enabled || controls.busy ? <Button type="button" variant="ghost" className={s.button} onClick={controls.deactivate}>Desactivar avisos</Button> : null}
      </div>
      <p className={s.description}>Son avisos locales mientras la app sincroniza. En iPhone o iPad puede ser necesario instalar la app en la pantalla de inicio.</p>
    </Card>
  );
}

const s = {
  notice: "mx-auto flex max-w-7xl flex-wrap items-center gap-2 border-b border-border bg-muted px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
  noticeText: "min-w-0 flex-1 text-sm text-foreground",
  button: "min-h-11 max-w-full whitespace-normal text-left",
  controls: "min-w-0 space-y-3 p-4 sm:p-6",
  title: "text-base font-semibold text-foreground",
  description: "text-sm text-muted-foreground",
  actions: "flex flex-wrap gap-2",
};
