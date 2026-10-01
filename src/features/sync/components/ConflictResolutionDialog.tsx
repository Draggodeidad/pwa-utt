"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HttpClient } from "@/lib/api/http-client";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { isPwaUpdatePreparing, trackPwaMutation } from "@/lib/pwa/update-coordination";
import { isSessionCurrent, sessionEpoch } from "@/lib/pwa/offline-session";
import type { ConflictRecord } from "../types";
import { resolveConflict } from "../services/resolve-conflict";

type SessionUser = { id: string; role: "technician" | "coordinator" };

async function sessionUser(): Promise<SessionUser | null> {
  const epoch = sessionEpoch();
  if (!isSessionCurrent(epoch)) return null;
  try {
    const response = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
    if (!isSessionCurrent(epoch)) return null;
    if (!response.ok) return null;
    const body = await response.json() as { user?: SessionUser };
    return body.user?.id && body.user.role && isSessionCurrent(epoch, body.user.id) ? body.user : null;
  } catch { return null; }
}

function captureLabel(snapshot: unknown, entity: ConflictRecord["entity"]): string {
  if (!snapshot || typeof snapshot !== "object") return "Copia no disponible";
  const bundled = snapshot as { entity?: unknown };
  const value = bundled.entity ?? snapshot;
  if (!value || typeof value !== "object") return "Copia no disponible";
  const record = value as Record<string, unknown>;
  const label = entity === "inspection" ? record.summary ?? record.scope : record.title;
  return typeof label === "string" && label.trim() ? label : "Captura sin título";
}

function reasonLabel(reason: ConflictRecord["reason"]): string {
  switch (reason) {
    case "version": return "Otra edición cambió la versión";
    case "state": return "La inspección ya está finalizada";
    case "finding_set": return "Cambió el conjunto de hallazgos";
    case "key_reused": return "La clave de operación se reutilizó con otro contenido";
    case "entity_reused": return "El identificador de la captura ya fue usado";
    case "inaccessible": return "No hay acceso al registro remoto";
    default: return "No se pudo clasificar el conflicto";
  }
}

export function ConflictResolutionPanel() {
  const [owner, setOwner] = useState<SessionUser | null>(null);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [selected, setSelected] = useState<ConflictRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const epoch = sessionEpoch();
    const session = await sessionUser();
    if (sessionEpoch() !== epoch) return;
    setOwner(session);
    if (!session) { setConflicts([]); return; }
    const storage = await LocalStorage.open();
    try {
      const records = await storage.listConflicts(session.id);
      if (isSessionCurrent(epoch, session.id)) setConflicts(records.filter((conflict) => !conflict.resolvedAt));
    }
    finally { storage.close(); }
  }, []);

  useEffect(() => {
    void reload().catch(() => setMessage("No se pudieron leer los conflictos locales"));
    const listener = () => { void reload().catch(() => setMessage("No se pudieron leer los conflictos locales")); };
    const lock = () => { if (!isSessionCurrent(sessionEpoch())) { setOwner(null); setConflicts([]); setSelected(null); setMessage(""); } };
    window.addEventListener("pwa-utt:queue-changed", listener);
    window.addEventListener("pwa-utt:session-changed", lock);
    window.addEventListener("storage", lock);
    return () => { window.removeEventListener("pwa-utt:queue-changed", listener); window.removeEventListener("pwa-utt:session-changed", lock); window.removeEventListener("storage", lock); };
  }, [reload]);

  const decide = async (decision: "mine" | "server") => {
    if (isPwaUpdatePreparing()) return;
    if (!selected || !owner || busy) return;
    const epoch = sessionEpoch();
    if (!isSessionCurrent(epoch, owner.id)) return;
    setBusy(true);
    setMessage("");
    const storage = await LocalStorage.open();
    try {
      const result = await trackPwaMutation(() => resolveConflict({
        storage, client: new HttpClient(), owner: owner.id,
        verifyOwner: async (expected) => { const current = await sessionUser(); return isSessionCurrent(epoch, expected) && current?.id === expected ? current.role : null; },
      }, selected.operationId, decision));
      if (!isSessionCurrent(epoch, owner.id)) return;
      setSelected(null);
      setMessage(result.newInspectionId ? "La captura se guardó en un borrador nuevo. La copia original sigue disponible." : "Resolución guardada; la captura original sigue recuperable.");
      await reload();
      window.dispatchEvent(new Event("pwa-utt:sync-now"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo resolver el conflicto");
    } finally {
      storage.close();
      setBusy(false);
    }
  };

  const canKeepMine = selected && (owner?.role === "technician" || owner?.role === "coordinator" && selected.failedOperation.operation === "finding.followup");

  if (!conflicts.length && !message) return null;
  return (
    <Card className={s.card}>
      <h2 className={s.title}>Conflictos de sincronización ({conflicts.length})</h2>
      <p className={s.description}>La captura local y la petición fallida se conservan en este dispositivo hasta que elijas una acción.</p>
      {message ? <p className={s.message} role="status">{message}</p> : null}
      <div className={s.list}>
        {conflicts.map((conflict) => (
          <div className={s.item} key={conflict.operationId}>
            <div>
              <p className={s.itemTitle}>{captureLabel(conflict.localSnapshot, conflict.entity)}</p>
              <p className={s.itemReason}>{reasonLabel(conflict.reason)} · versión local {conflict.localVersion ?? "nueva"}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => { setSelected(conflict); setMessage(""); }}>Comparar copias</Button>
          </div>
        ))}
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !busy) setSelected(null); }}>
        <DialogContent className={s.dialog}>
          <DialogTitle>Resolver conflicto</DialogTitle>
          <DialogDescription>{selected ? reasonLabel(selected.reason) : ""}</DialogDescription>
          {selected ? (
            <>
              <div className={s.comparison}>
                <section className={s.copy}>
                  <h3 className={s.copyTitle}>Mi captura</h3>
                  <p>{captureLabel(selected.localSnapshot, selected.entity)}</p>
                  <p className={s.version}>Versión base: {selected.localVersion ?? "nueva"}</p>
                </section>
                <section className={s.copy}>
                  <h3 className={s.copyTitle}>Servidor autorizado</h3>
                  <p>{selected.remoteSnapshot ? captureLabel(selected.remoteSnapshot, selected.entity) : "No disponible"}</p>
                  <p className={s.version}>Versión: {selected.remoteVersion ?? "no disponible"}</p>
                </section>
              </div>
              {selected.reason === "key_reused" || selected.reason === "inaccessible" ? <p className={s.warning}>Esta operación requiere revisión. No se puede resolver con una versión remota que no es visible.</p> : null}
              {message ? <p className={s.warning} role="alert">{message}</p> : null}
              <div className={s.actions}>
                <Button type="button" variant="outline" disabled={busy || selected.reason === "key_reused" || selected.reason === "inaccessible"} onClick={() => void decide("server")}>Usar la del servidor</Button>
                <Button type="button" disabled={busy || !canKeepMine || selected.reason === "key_reused" || selected.reason === "inaccessible"} onClick={() => void decide("mine")}>
                  {selected.reason === "state" ? "Copiar a borrador nuevo" : "Mantener la mía"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const s = {
  card: "space-y-3 border-amber-300 bg-amber-50 p-6 shadow-sm",
  title: "text-base font-semibold text-amber-950",
  description: "text-sm text-amber-900",
  message: "text-sm text-amber-900",
  list: "space-y-2",
  item: "flex flex-col gap-3 rounded-sm border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between",
  itemTitle: "font-medium",
  itemReason: "text-xs text-muted-foreground",
  dialog: "max-w-2xl",
  comparison: "grid gap-3 sm:grid-cols-2",
  copy: "space-y-2 rounded-sm border p-3 text-sm",
  copyTitle: "font-semibold",
  version: "text-xs text-muted-foreground",
  warning: "rounded-sm bg-amber-100 p-3 text-sm text-amber-950",
  actions: "flex flex-col gap-2 sm:flex-row sm:justify-end",
};
