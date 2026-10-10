"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api/client";
import { HttpClient } from "@/lib/api/http-client";
import { getConnectivityState } from "@/lib/pwa/connectivity";
import { isSessionCurrent, sessionEpoch } from "@/lib/pwa/offline-session";
import { isPwaUpdatePreparing, trackPwaMutation } from "@/lib/pwa/update-coordination";
import { coordinationActions, reviewLabels, type CoordinationAction, type CoordinationRequest } from "../coordination";
import { submitCoordination } from "../services/coordinate-inspection";
import type { InspectionDetail } from "../types";

const reviewedDate = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
const actionLabels: Record<CoordinationAction, string> = { approve: "Aprobar", reject: "Rechazar", archive: "Archivar", unarchive: "Desarchivar", delete: "Eliminar lógicamente" };

export function InspectionCoordinationPanel({ inspection: initial, owner }: { inspection: InspectionDetail; owner: string }) {
  const router = useRouter();
  const [inspection, setInspection] = useState(initial);
  const [online, setOnline] = useState(false);
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState<CoordinationAction | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const epoch = useRef(sessionEpoch());
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { setInspection(initial); }, [initial]);
  useEffect(() => {
    mounted.current = true;
    const update = () => setOnline(getConnectivityState() === "online" && isSessionCurrent(epoch.current));
    update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    window.addEventListener("storage", update); window.addEventListener("pwa-utt:session-changed", update);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", update); window.removeEventListener("offline", update);
      window.removeEventListener("storage", update); window.removeEventListener("pwa-utt:session-changed", update);
    };
  }, []);
  const c = inspection.coordination;
  const allowed = coordinationActions(inspection);
  const valid = action !== "reject" || notes.trim().length > 0;
  const confirmed = action !== "delete" || confirmation === inspection.folio;
  const open = (next: CoordinationAction) => { setAction(next); setError(""); setMessage(""); setConfirmation(""); };

  const submit = async () => {
    if (!action || inFlight.current || !valid || !confirmed || conflict || isPwaUpdatePreparing()) return;
    inFlight.current = true; setBusy(true); setError("");
    const request: CoordinationRequest = { action, baseVersion: inspection.version,
      ...(["approve", "reject"].includes(action) ? { notes } : {}),
      ...(action === "delete" ? { confirmation } : {}) };
    const body = JSON.stringify(request);
    if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
    try {
      const ack = await trackPwaMutation(() => submitCoordination(new HttpClient(), inspection.id, request, attempt.current!.key, {
        owner, isOnline: () => getConnectivityState() === "online",
        isCurrent: () => mounted.current && isSessionCurrent(epoch.current),
      }));
      if (!mounted.current || !isSessionCurrent(epoch.current)) return;
      setAction(null); setNotes(""); attempt.current = null;
      if (ack.deletedAt) router.push("/inspections/archive?notice=deleted");
      else if (action === "archive") router.push("/inspections/archive?notice=archived");
      else if (action === "unarchive") router.push("/inspections?notice=unarchived");
      else {
        setInspection(current => ({ ...current, version: ack.version, coordination: c ? {
          ...c, reviewStatus: ack.reviewStatus, reviewNotes: ack.reviewNotes, reviewedBy: ack.reviewedBy,
          reviewedAt: ack.reviewedAt,
        } : undefined }));
        setMessage("Decisión registrada. La revisión es final.");
      }
      router.refresh();
    } catch (failure) {
      if (!mounted.current || !isSessionCurrent(epoch.current)) return;
      setError(failure instanceof Error ? failure.message : "No se pudo completar la acción. Intenta de nuevo.");
      if (failure instanceof ApiClientError && failure.status === 409) setConflict(true);
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  if (!c) return null;
  return <Card className={s.panel} aria-labelledby="coordination-title">
    <h2 id="coordination-title" className={s.title}>Revisión de coordinación</h2>
    <p className={s.status}>{reviewLabels[c.reviewStatus]}{c.archivedAt ? " · Archivada" : " · Activa"}</p>
    {c.reviewedAt ? <div className={s.record}>
      <p>Decisión: <time dateTime={c.reviewedAt}>{reviewedDate.format(new Date(c.reviewedAt))}</time></p>
      <p className={s.actor}>Coordinador: {c.reviewedBy}</p>
      <p className={s.notes}>{c.reviewNotes || "Sin nota de coordinación."}</p>
    </div> : <p className={s.hint}>La decisión es final. Rechazar requiere motivo y conserva el estado de los hallazgos.</p>}
    {!online ? <p role="status" className={s.offline}>Sin conexión: revisar, archivar, desarchivar y eliminar requieren conexión. No se guardan en la cola offline.</p> : null}
    <div className={s.actions}>{allowed.map(next => <Button key={next} variant="outline" className={next === "delete" ? s.destructive : undefined} disabled={!online || busy || conflict} onClick={() => open(next)}>{actionLabels[next]}</Button>)}</div>
    {message ? <p role="status" className={s.hint}>{message}</p> : null}
    {conflict ? <div role="alert" className={s.error}><p>La inspección cambió. Recarga para revisar su estado actual.</p><Button variant="outline" onClick={() => window.location.reload()}>Recargar detalle</Button></div> : null}
    <AlertDialog open={action !== null} onOpenChange={value => { if (!value && !busy) setAction(null); }}>
      <AlertDialogContent>
        <AlertDialogTitle>{action ? actionLabels[action] : "Revisión"} · {inspection.folio}</AlertDialogTitle>
        <AlertDialogDescription>{action === "delete"
          ? "Se ocultará de las vistas ordinarias. Los datos y las evidencias se conservarán. Escribe el folio exacto para confirmar."
          : action === "archive" ? "La inspección saldrá de Activas y estará disponible en Histórico."
          : action === "unarchive" ? "Volverá a Activas conservando la decisión y el estado de los hallazgos."
          : "La decisión no podrá modificarse después. Las observaciones del técnico se conservan."}</AlertDialogDescription>
        {action === "approve" || action === "reject" ? <label className={s.field} htmlFor="coordination-notes">{action === "reject" ? "Motivo del rechazo (obligatorio)" : "Nota de coordinación (opcional)"}<Textarea id="coordination-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} disabled={busy} required={action === "reject"} /></label> : null}
        {action === "delete" ? <label className={s.field} htmlFor="coordination-confirmation">Escribe {inspection.folio}<Input autoComplete="off" id="coordination-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label> : null}
        {!online ? <p role="status" className={s.offline}>Se perdió la conexión. Reconecta antes de confirmar.</p> : null}
        {error ? <p role="alert" className={s.error}>{error}</p> : null}
        <div className={s.actions}><AlertDialogCancel asChild><Button variant="outline" disabled={busy}>Cancelar</Button></AlertDialogCancel><Button className={action === "delete" ? s.destructive : undefined} disabled={busy || !online || !valid || !confirmed || conflict} onClick={() => void submit()}>{busy ? "Guardando…" : "Confirmar"}</Button></div>
      </AlertDialogContent>
    </AlertDialog>
  </Card>;
}

const s = {
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  panel: "mt-6 space-y-4 p-5 sm:p-7",
  title: "text-lg font-semibold",
  status: "text-sm font-medium text-secondary-foreground",
  record: "space-y-2 rounded-sm bg-secondary/50 p-3 text-sm",
  actor: "break-all text-xs text-muted-foreground",
  notes: "whitespace-pre-wrap break-words",
  hint: "text-sm text-muted-foreground",
  offline: "rounded-sm bg-amber-50 p-3 text-sm text-amber-900",
  actions: "flex flex-wrap gap-2",
  field: "grid gap-2 text-sm font-medium",
  error: "space-y-2 text-sm text-destructive",
};
