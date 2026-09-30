"use client";

import { useEffect, useState } from "react";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { isSessionCurrent, readLocalSession, sessionEpoch, type LocalSession } from "@/lib/pwa/offline-session";
import { loadLocalDraft, toEditorValues, toLocalInspectionListItem } from "@/features/inspections/services/local-capture";
import { InspectionDetailWorkspace, InspectionEditorWorkspace } from "@/features/inspections";
import { useOfflineReadiness } from "./use-offline-readiness";
import type { InspectionDetail, InspectionEditorValues, InspectionListItem, LaboratoryOption } from "@/features/inspections";
import type { LocalInspection } from "@/features/inspections/types";
import type { LocalFinding } from "@/features/findings/types";

type OfflineView =
  | { kind: "list" }
  | { kind: "detail"; id: string }
  | { kind: "create" }
  | { kind: "edit"; id: string };

type OfflinePhase = "loading" | "ready" | "no-session" | "missing";

function parseView(pathname: string): OfflineView {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "inspections" && segments.length === 1) return { kind: "list" };
  if (segments[0] === "inspections" && segments[1] === "new") return { kind: "create" };
  if (segments[0] === "inspections" && segments[2] === "edit") return { kind: "edit", id: segments[1] };
  if (segments[0] === "inspections" && segments[1]) return { kind: "detail", id: segments[1] };
  return { kind: "list" };
}

function createValues(technician: string): InspectionEditorValues {
  return { id: "", folio: "—", laboratoryCode: "", date: "", technician, summary: "", findings: [], syncStatus: "local", version: null };
}

function toDetail(local: LocalInspection, findings: readonly LocalFinding[], catalog: readonly LaboratoryOption[], technician: string): InspectionDetail {
  const laboratory = local.laboratoryId ? catalog.find((option) => option.id === local.laboratoryId) : undefined;
  return {
    id: local.id,
    folio: local.folioNumber ? `INS-${local.folioNumber}` : "—",
    location: laboratory?.name ?? "Laboratorio no asignado",
    date: local.inspectionDate ?? "",
    technician,
    workflowStatus: local.workflowStatus,
    result: findings.length ? "requires_attention" : "without_findings",
    syncStatus: local.syncStatus,
    scope: local.summary,
    version: local.baseVersion ?? 0,
    findings: findings.map((finding) => ({ id: finding.id, priority: finding.priority, status: finding.status, title: finding.title, description: finding.description, version: finding.baseVersion })),
  };
}

export function OfflineShell() {
  const readiness = useOfflineReadiness();
  const [phase, setPhase] = useState<OfflinePhase>("loading");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [catalog, setCatalog] = useState<readonly LaboratoryOption[]>([]);
  const [view] = useState<OfflineView>(() => (typeof window === "undefined" ? { kind: "list" } : parseView(window.location.pathname)));
  const [items, setItems] = useState<readonly InspectionListItem[]>([]);
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [editorValues, setEditorValues] = useState<InspectionEditorValues | null>(null);

  useEffect(() => {
    let active = true;
    const epoch = sessionEpoch();
    const lock = () => {
      if (!isSessionCurrent(epoch)) {
        active = false;
        setSession(null);
        setCatalog([]);
        setItems([]);
        setDetail(null);
        setEditorValues(null);
        setPhase("no-session");
      }
    };
    window.addEventListener("pwa-utt:session-changed", lock);
    window.addEventListener("storage", lock);
    (async () => {
      const remembered = readLocalSession();
      if (!remembered) {
        if (active) setPhase("no-session");
        return;
      }
      let storage: LocalStorage;
      try {
        storage = await LocalStorage.open();
      } catch {
        if (active) setPhase("no-session");
        return;
      }
      try {
      const catalogList = await storage.getCatalog(remembered.userId);
      if (!active || !isSessionCurrent(epoch, remembered.userId)) return;
      setSession(remembered);
      setCatalog(catalogList);

      if (view.kind === "list") {
        const locals = await storage.listInspections(remembered.userId);
        const findings = await storage.listFindings(remembered.userId);
        const counts = new Map<string, number>();
        for (const finding of findings) {
          if (finding.deletedAt === null) counts.set(finding.inspectionId, (counts.get(finding.inspectionId) ?? 0) + 1);
        }
        const listItems = locals
          .filter((local) => local.deletedAt === null)
          .map((local) => toLocalInspectionListItem(local, counts.get(local.id) ?? 0, remembered.displayName, catalogList));
        if (active && isSessionCurrent(epoch, remembered.userId)) setItems(listItems);
      } else if (view.kind === "detail") {
        const draft = await loadLocalDraft(remembered.userId, storage, view.id);
        if (draft) {
          if (active && isSessionCurrent(epoch, remembered.userId)) setDetail(toDetail(draft.inspection, draft.findings, catalogList, remembered.displayName));
        } else if (active) setPhase("missing");
      } else if (view.kind === "edit") {
        const draft = await loadLocalDraft(remembered.userId, storage, view.id);
        if (draft) {
          if (active && isSessionCurrent(epoch, remembered.userId)) setEditorValues(toEditorValues(draft.inspection, draft.findings, catalogList, remembered.displayName));
        } else if (active) setPhase("missing");
      } else {
        if (active && isSessionCurrent(epoch, remembered.userId)) setEditorValues(createValues(remembered.displayName));
      }
      if (active && isSessionCurrent(epoch, remembered.userId)) setPhase("ready");
      } catch { if (active) setPhase("no-session"); }
      finally { storage.close(); }
    })();
    return () => { active = false; window.removeEventListener("pwa-utt:session-changed", lock); window.removeEventListener("storage", lock); };
  }, [view]);

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Modo sin conexión</p>
          <h1 className={s.title}>Inspecciones locales</h1>
          <p className={s.description}>Estás trabajando con los datos guardados en este dispositivo.</p>
        </div>
        <span className={readiness === "ready" ? s.readyBadge : s.pendingBadge} role="status">
          {readiness === "checking" ? "Comprobando soporte offline…" : readiness === "ready" ? "Listo para trabajar sin conexión" : "Soporte offline incompleto"}
        </span>
      </header>

      {phase === "loading" ? <p className={s.stateText}>Cargando datos locales…</p> : null}
      {phase === "no-session" ? (
        <section className={s.empty}>
          <h2 className={s.emptyTitle}>Sin sesión local</h2>
          <p className={s.emptyDescription}>Inicia sesión estando en línea para acceder a tus borradores guardados en este dispositivo.</p>
        </section>
      ) : null}
      {phase === "missing" ? (
        <section className={s.empty}>
          <h2 className={s.emptyTitle}>Borrador no disponible</h2>
          <p className={s.emptyDescription}>No se encontró una copia local de este borrador.</p>
          <a href="/inspections" className={s.action}>Volver al listado</a>
        </section>
      ) : null}

      {phase === "ready" && view.kind === "list" ? (
        <section aria-labelledby="offline-list-title">
          <div className={s.listHeader}>
            <h2 id="offline-list-title" className={s.sectionTitle}>Mis borradores</h2>
            <a href="/inspections/new" className={s.action}>Nueva inspección</a>
          </div>
          {items.length === 0 ? (
            <p className={s.stateText}>No hay borradores guardados en este dispositivo.</p>
          ) : (
            <ul className={s.list}>
              {items.map((item) => (
                <li key={item.id}>
                  <a href={`/inspections/${item.id}`} className={s.item}>
                    <span className={s.itemName}>{item.location}</span>
                    <span className={s.itemMeta}>{item.date || "Sin fecha"} · {item.findingCount} hallazgo{item.findingCount === 1 ? "" : "s"}</span>
                    <span className={s.itemStatus}>{item.syncStatus === "synced" ? "Sincronizado" : "Pendiente"}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {phase === "ready" && view.kind === "detail" && detail && session ? (
        <InspectionDetailWorkspace inspection={detail} owner={session.userId} />
      ) : null}

      {phase === "ready" && (view.kind === "create" || view.kind === "edit") && editorValues && session ? (
        <InspectionEditorWorkspace mode={view.kind === "create" ? "create" : "edit"} initialValues={editorValues} catalog={catalog} owner={session.userId} />
      ) : null}
    </main>
  );
}

const s = {
  page: "mx-auto max-w-[1050px] px-6 py-8",
  header: "flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between",
  eyebrow: "font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground",
  title: "mt-1 text-3xl font-semibold tracking-tight",
  description: "mt-1 text-sm text-muted-foreground",
  readyBadge: "rounded-sm bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-900",
  pendingBadge: "rounded-sm bg-secondary px-3 py-1.5 text-xs text-secondary-foreground",
  stateText: "mt-8 text-sm text-muted-foreground",
  empty: "mt-8 rounded-sm border border-dashed p-8 text-center",
  emptyTitle: "text-lg font-semibold",
  emptyDescription: "mt-2 text-sm text-muted-foreground",
  action: "mt-4 inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
  listHeader: "mt-8 flex items-center justify-between",
  sectionTitle: "text-xl font-semibold",
  list: "mt-3 space-y-3",
  item: "flex flex-col gap-1 rounded-sm border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between",
  itemName: "font-medium",
  itemMeta: "text-sm text-muted-foreground",
  itemStatus: "text-xs text-muted-foreground",
};
