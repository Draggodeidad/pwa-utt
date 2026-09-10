"use client";

import { useEffect, useState } from "react";
import { CircleAlert, FileImage, MapPin, Save, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCoordinationFindings } from "../hooks/use-coordination-findings";
import type { CoordinationFinding, FindingPriority, FindingStatus } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const priorityLabels: Record<FindingPriority, string> = { high: "Alta", medium: "Media", low: "Baja" };
const statusLabels: Record<FindingStatus, string> = { pending: "Pendiente", in_review: "En revisión", resolved: "Atendido" };

function PriorityBadge({ priority }: { priority: FindingPriority }) {
  return <Badge className={priority === "high" ? s.priorityHigh : priority === "medium" ? s.priorityMedium : s.priorityLow}>{priorityLabels[priority]}</Badge>;
}

function StatusBadge({ status }: { status: FindingStatus }) {
  return <Badge className={status === "pending" ? s.statusPending : status === "in_review" ? s.statusReview : s.statusResolved}>{statusLabels[status]}</Badge>;
}

function FindingsSkeleton() {
  return (
    <div className={s.skeleton} aria-label="Cargando hallazgos">
      <Card className={s.filtersSkeleton} />
      <div className={s.contentGrid}><Card className={s.listSkeleton} /><Card className={s.detailSkeleton} /></div>
    </div>
  );
}

function FindingListItem({ finding, selected, onSelect }: { finding: CoordinationFinding; selected: boolean; onSelect: () => void }) {
  return (
    <button className={selected ? s.findingItemSelected : s.findingItem} type="button" aria-pressed={selected} onClick={onSelect}>
      <span className={s.findingTopline}><span className={s.folio}>{finding.folio}</span><span className={s.badges}><PriorityBadge priority={finding.priority} /><StatusBadge status={finding.status} /></span></span>
      <span className={s.findingTitle}>{finding.title}</span>
      <span className={s.findingMeta}><span className={s.location}><MapPin className={s.locationIcon} aria-hidden="true" />{finding.laboratory}</span><span>{dateFormatter.format(new Date(`${finding.date}T12:00:00`))}</span></span>
    </button>
  );
}

function FindingDetail({ finding, onSave, isSaving }: { finding: CoordinationFinding; onSave: (changes: Pick<CoordinationFinding, "priority" | "status" | "internalNote">) => void; isSaving: boolean }) {
  const [priority, setPriority] = useState(finding.priority);
  const [status, setStatus] = useState(finding.status);
  const [internalNote, setInternalNote] = useState(finding.internalNote);

  useEffect(() => {
    setPriority(finding.priority);
    setStatus(finding.status);
    setInternalNote(finding.internalNote);
  }, [finding]);

  return (
    <Card className={s.detailCard}>
      <div className={s.detailHeader}><div><p className={s.detailFolio}>{finding.folio}</p><h2 id="finding-detail-title" className={s.detailTitle}>{finding.title}</h2></div><span className={s.badges}><PriorityBadge priority={finding.priority} /><StatusBadge status={finding.status} /></span></div>
      <dl className={s.details}><div><dt>Descripción</dt><dd>{finding.description}</dd></div><div className={s.detailFacts}><div><dt>Laboratorio</dt><dd>{finding.laboratory}</dd></div><div><dt>Fecha</dt><dd>{dateFormatter.format(new Date(`${finding.date}T12:00:00`))}</dd></div><div><dt>Técnico que registró</dt><dd>{finding.technician}</dd></div></div></dl>
      {finding.evidenceLabel ? <section className={s.evidence} aria-labelledby="evidence-title"><h3 id="evidence-title" className={s.sectionLabel}>Evidencia</h3>{finding.evidenceImage ? <img className={s.evidenceImage} src={finding.evidenceImage} alt={finding.evidenceLabel} /> : <p className={s.evidenceText}><FileImage className={s.evidenceIcon} aria-hidden="true" />{finding.evidenceLabel}</p>}</section> : null}
      <section className={s.editor} aria-labelledby="follow-up-title"><h3 id="follow-up-title" className={s.editorTitle}>Seguimiento de coordinación</h3><div className={s.editorFields}><label className={s.field}><span>Prioridad</span><select className={s.select} value={priority} onChange={(event) => setPriority(event.target.value as FindingPriority)}><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></label><label className={s.field}><span>Estado</span><select className={s.select} value={status} onChange={(event) => setStatus(event.target.value as FindingStatus)}><option value="pending">Pendiente</option><option value="in_review">En revisión</option><option value="resolved">Atendido</option></select></label></div><label className={s.field}><span>Nota interna</span><Textarea className={s.note} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Agrega una nota breve de seguimiento." /></label><div className={s.saveRow}><Button type="button" onClick={() => onSave({ priority, status, internalNote })} disabled={isSaving}><Save className={s.saveIcon} aria-hidden="true" />{isSaving ? "Guardando..." : "Guardar cambios"}</Button></div></section>
    </Card>
  );
}

export function CoordinationFindingsWorkspace({ findings }: { findings: readonly CoordinationFinding[] | undefined }) {
  const { state, filters, filteredFindings, selectedFinding, selectedId, pendingCount, isSaving, retry, clearFilters, saveFinding, setFilters, setSelectedId } = useCoordinationFindings(findings);
  const hasActiveFilters = filters.query.length > 0 || filters.priority !== "all" || filters.status !== "all";

  return (
    <section className={s.page} aria-labelledby="findings-title">
      <header className={s.header}><div><h1 id="findings-title" className={s.title}>Hallazgos</h1><p className={s.subtitle}>Consulta y seguimiento de problemas detectados durante las inspecciones.</p></div><Badge className={s.pendingBadge}><span className={s.pendingDot} aria-hidden="true" />{pendingCount} pendiente{pendingCount === 1 ? "" : "s"}</Badge></header>
      {state === "loading" ? <FindingsSkeleton /> : null}
      {state === "error" ? <Card className={s.errorState} role="alert"><CircleAlert className={s.errorIcon} aria-hidden="true" /><div><h2 className={s.errorTitle}>No fue posible cargar los hallazgos</h2><p className={s.errorDescription}>Intenta de nuevo para consultar la información.</p></div><Button className={s.retryButton} type="button" variant="outline" onClick={retry}>Reintentar</Button></Card> : null}
      {state === "empty" ? <Card className={s.emptyState}><h2 className={s.emptyTitle}>No hay hallazgos registrados</h2><p className={s.emptyDescription}>Los hallazgos aparecerán aquí cuando una inspección los registre.</p></Card> : null}
      {state === "ready" ? <div className={s.workspace}><section className={s.filtersCard} aria-label="Buscar y filtrar hallazgos"><label className={s.searchField}><span className={s.srOnly}>Buscar hallazgos</span><Search className={s.searchIcon} aria-hidden="true" /><Input className={s.searchInput} value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Buscar por folio, laboratorio o descripción..." /></label><div className={s.filterControls}><label className={s.filterField}><span>Prioridad</span><select className={s.select} value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value as FindingPriority | "all" })}><option value="all">Todas</option><option value="high">Alta</option><option value="medium">Media</option><option value="low">Baja</option></select></label><label className={s.filterField}><span>Estado</span><select className={s.select} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as FindingStatus | "all" })}><option value="all">Todos</option><option value="pending">Pendiente</option><option value="in_review">En revisión</option><option value="resolved">Atendido</option></select></label><Button className={s.clearButton} type="button" variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters}>Limpiar filtros</Button></div></section><div className={s.contentGrid}><section className={s.listSection} aria-labelledby="findings-list-title"><div className={s.listHeading}><h2 id="findings-list-title">{filteredFindings.length} hallazgo{filteredFindings.length === 1 ? "" : "s"}</h2><span>Recientes primero</span></div>{filteredFindings.length === 0 ? <Card className={s.noResults}><h3>No se encontraron hallazgos</h3><p>Ajusta la búsqueda o los filtros para ver otros resultados.</p><Button type="button" variant="outline" onClick={clearFilters}>Limpiar filtros</Button></Card> : <div className={s.findingsList}>{filteredFindings.map((finding) => <FindingListItem key={finding.id} finding={finding} selected={finding.id === selectedId} onSelect={() => setSelectedId(finding.id === selectedId ? undefined : finding.id)} />)}</div>}</section><aside className={s.detailSection} aria-labelledby="finding-detail-title">{selectedFinding ? <FindingDetail finding={selectedFinding} onSave={saveFinding} isSaving={isSaving} /> : <Card className={s.placeholder}><h2 id="finding-detail-title">Selecciona un hallazgo</h2><p>Elige un elemento de la lista para consultar su detalle y seguimiento.</p></Card>}</aside></div></div> : null}
    </section>
  );
}

const s = {
  page: "mx-auto max-w-[1200px]",
  header: "flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between",
  title: "text-[32px] font-semibold tracking-tight",
  subtitle: "mt-1 text-sm text-secondary-foreground",
  pendingBadge: "self-start rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive",
  pendingDot: "mr-1.5 inline-block size-2 rounded-full bg-destructive",
  workspace: "mt-6 space-y-6",
  filtersCard: "flex flex-col gap-3 rounded-md border bg-card p-3 shadow-sm lg:flex-row lg:items-end",
  searchField: "relative block min-w-0 flex-1",
  srOnly: "sr-only",
  searchIcon: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-foreground",
  searchInput: "bg-secondary/60 pl-9",
  filterControls: "flex flex-col gap-3 sm:flex-row sm:items-end",
  filterField: "grid gap-1 font-mono text-[11px] font-medium uppercase tracking-[.05em] text-secondary-foreground",
  select: "h-10 rounded-md border border-input bg-secondary/60 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  clearButton: "h-10 self-end rounded-sm px-2 font-mono text-[11px] tracking-[.05em]",
  contentGrid: "grid items-start gap-6 lg:grid-cols-[minmax(18rem,5fr)_minmax(0,7fr)]",
  listSection: "min-w-0",
  listHeading: "mb-2 flex items-center justify-between px-1 font-mono text-[11px] font-medium uppercase tracking-[.05em] text-secondary-foreground",
  findingsList: "max-h-[32rem] space-y-2 overflow-y-auto pr-1",
  findingItem: "block w-full rounded-md border bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  findingItemSelected: "block w-full rounded-md border-2 border-primary bg-card p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  findingTopline: "flex items-start justify-between gap-2",
  folio: "rounded-sm bg-secondary px-1 py-0.5 font-mono text-xs font-semibold text-primary",
  badges: "flex flex-wrap items-center justify-end gap-1",
  priorityHigh: "rounded-sm border-0 bg-destructive/15 px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive",
  priorityMedium: "rounded-sm border-0 bg-[#d2e7de] px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#4f625b]",
  priorityLow: "rounded-sm border-0 bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-secondary-foreground",
  statusPending: "rounded-sm border-0 bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-foreground",
  statusReview: "rounded-sm border-0 bg-[#cfe4db] px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#4f625b]",
  statusResolved: "rounded-sm border-0 bg-[#cfe4db] px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#4f625b]",
  findingTitle: "mt-3 block text-sm font-semibold text-foreground",
  findingMeta: "mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] tracking-[.03em] text-secondary-foreground",
  location: "flex items-center gap-1",
  locationIcon: "size-3",
  detailSection: "min-w-0",
  detailCard: "space-y-6 p-5 shadow-sm",
  detailHeader: "flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between",
  detailFolio: "font-mono text-xs font-semibold text-secondary-foreground",
  detailTitle: "mt-1 text-xl font-semibold tracking-tight",
  details: "space-y-5 text-sm",
  detailFacts: "grid gap-4 sm:grid-cols-3",
  evidence: "space-y-2",
  sectionLabel: "font-mono text-[11px] font-medium uppercase tracking-[.05em] text-secondary-foreground",
  evidenceImage: "max-h-64 w-full rounded-md border object-cover",
  evidenceText: "flex items-center gap-2 rounded-sm bg-secondary/60 p-3 text-sm text-secondary-foreground",
  evidenceIcon: "size-4 shrink-0",
  editor: "space-y-4 border-t pt-5",
  editorTitle: "font-semibold",
  editorFields: "grid gap-4 sm:grid-cols-2",
  field: "grid gap-1.5 text-sm font-medium",
  note: "min-h-24 bg-secondary/40",
  saveRow: "flex justify-end",
  saveIcon: "mr-2 size-4",
  skeleton: "mt-6 space-y-6",
  filtersSkeleton: "h-16 animate-pulse bg-secondary",
  listSkeleton: "h-72 animate-pulse bg-secondary",
  detailSkeleton: "h-96 animate-pulse bg-secondary",
  errorState: "mt-6 flex flex-col gap-3 p-6 sm:flex-row sm:items-center",
  errorIcon: "size-5 shrink-0 text-destructive",
  errorTitle: "font-semibold",
  errorDescription: "mt-1 text-sm text-secondary-foreground",
  retryButton: "sm:ml-auto",
  emptyState: "mt-6 p-8 text-center",
  emptyTitle: "font-semibold",
  emptyDescription: "mt-1 text-sm text-secondary-foreground",
  noResults: "space-y-3 p-6 text-center",
  placeholder: "p-8 text-center",
};
