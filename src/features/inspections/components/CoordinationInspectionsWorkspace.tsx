"use client";

import Link from "next/link";
import { CircleAlert, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useInspectionFilters } from "../hooks/use-inspection-filters";
import { useInspectionListState } from "../hooks/use-inspection-list-state";
import type { InspectionListItem } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function inspectionFolio(id: string) {
  return `INS-${id.replace("inspection-", "").padStart(3, "0")}`;
}

function ResultBadge({ result }: { result: InspectionListItem["result"] }) {
  return <Badge className={result === "requires_attention" ? s.resultAttention : s.resultClear}>{result === "requires_attention" ? "Requiere atención" : "Sin incidencias"}</Badge>;
}

function WorkflowBadge({ status }: { status: InspectionListItem["workflowStatus"] }) {
  return <Badge className={status === "completed" ? s.workflowCompleted : s.workflowDraft}>{status === "completed" ? "Finalizada" : "Borrador"}</Badge>;
}

function SyncBadge({ status }: { status: InspectionListItem["syncStatus"] }) {
  const label = status === "synced" ? "Sincronizada" : status === "syncing" ? "Sincronizando" : status === "error" ? "Error" : "Pendiente";
  return <Badge className={status === "synced" ? s.syncComplete : status === "error" ? s.syncError : s.syncPending}>{label}</Badge>;
}

function InspectionsTable({ inspections }: { inspections: readonly InspectionListItem[] }) {
  return <div className={s.tableFrame}><div className={s.tableScroll}><table className={s.table}><thead><tr><th className={s.tableHeader}>Folio</th><th className={s.tableHeader}>Laboratorio</th><th className={s.tableHeader}>Técnico</th><th className={s.tableHeader}>Fecha</th><th className={s.tableHeader}>Resultado</th><th className={s.tableHeader}>Estado</th><th className={s.tableHeader}>Sincronización</th><th className={s.tableHeader}><span className={s.actionHeader}>Acción</span></th></tr></thead><tbody>{inspections.map((inspection) => <tr className={s.tableRow} key={inspection.id}><td className={`${s.tableCell} ${s.folio}`}>{inspectionFolio(inspection.id)}</td><td className={s.tableCell}><p className={s.laboratory}>{inspection.location}</p><p className={s.laboratoryCode}>{inspection.laboratoryCode}</p></td><td className={s.tableCell}>{inspection.inspector}</td><td className={s.tableCell}><time dateTime={inspection.date}>{dateFormatter.format(new Date(`${inspection.date}T12:00:00`))}</time></td><td className={s.tableCell}><ResultBadge result={inspection.result} /></td><td className={s.tableCell}><WorkflowBadge status={inspection.workflowStatus} /></td><td className={s.tableCell}><SyncBadge status={inspection.syncStatus} /></td><td className={`${s.tableCell} ${s.actionCell}`}><Button asChild className={s.detailButton} variant="ghost" size="sm"><Link href={`/inspections/${inspection.id}`} aria-label={`Ver detalle de ${inspection.location}`}>Ver detalle</Link></Button></td></tr>)}</tbody></table></div></div>;
}

function LoadingTable() {
  return <Card className={s.loadingTable} aria-label="Cargando inspecciones"><div className={s.loadingFilters} />{Array.from({ length: 4 }, (_, index) => <div className={s.loadingRow} key={index} />)}</Card>;
}

export function CoordinationInspectionsWorkspace({ inspections }: { inspections: readonly InspectionListItem[] | undefined }) {
  const [isLoading, setIsLoading] = useState(true);
  const records = inspections ?? [];
  const { query, result, status, filteredInspections, hasActiveFilters, clearFilters, setQuery, setResult, setStatus } = useInspectionFilters(records);
  const stateRecords = isLoading ? [] : filteredInspections;
  const { state } = useInspectionListState({ records: stateRecords, hasActiveFilters, isLoading, error: inspections ? null : new Error("Inspecciones no disponibles") });

  useEffect(() => { const timeoutId = window.setTimeout(() => setIsLoading(false), 250); return () => window.clearTimeout(timeoutId); }, []);

  const retry = () => { setIsLoading(true); window.setTimeout(() => setIsLoading(false), 200); };

  return <section className={s.page} aria-labelledby="coordination-inspections-title">
    <header className={s.header}><div className={s.heading}><h1 id="coordination-inspections-title" className={s.title}>Inspecciones</h1><Badge className={s.countBadge}>{records.length} registradas</Badge></div><p className={s.subtitle}>Consulta las inspecciones realizadas en los laboratorios de cómputo.</p></header>
    {state === "loading" ? <LoadingTable /> : null}
    {state === "error" ? <Card className={s.errorState} role="alert"><CircleAlert className={s.errorIcon} aria-hidden="true" /><div><h2 className={s.errorTitle}>No fue posible cargar las inspecciones</h2><p className={s.errorDescription}>Intenta de nuevo para consultar los registros.</p></div><Button className={s.retryButton} type="button" variant="outline" onClick={retry}>Reintentar</Button></Card> : null}
    {state === "empty" ? <Card className={s.emptyState}><h2 className={s.emptyTitle}>No hay inspecciones registradas</h2><p className={s.emptyDescription}>Los registros aparecerán aquí cuando se realice una inspección.</p></Card> : null}
    {state === "success" || state === "offline-with-data" || state === "filtered-empty" ? <div className={s.workspace}><section className={s.filters} aria-label="Buscar y filtrar inspecciones"><label className={s.searchField}><span className={s.srOnly}>Buscar inspecciones</span><Search className={s.searchIcon} aria-hidden="true" /><Input className={s.searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por folio, laboratorio o técnico..." /></label><div className={s.filterControls}><label className={s.filterField}><span>Resultado</span><select className={s.select} value={result} onChange={(event) => setResult(event.target.value as typeof result)}><option value="all">Todos</option><option value="without_findings">Sin incidencias</option><option value="requires_attention">Requiere atención</option></select></label><label className={s.filterField}><span>Estado</span><select className={s.select} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Todos</option><option value="draft">Borrador</option><option value="completed">Finalizada</option></select></label><Button className={s.clearButton} type="button" variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters}>Limpiar filtros</Button></div></section>{state === "filtered-empty" ? <Card className={s.noResults}><h2>No se encontraron inspecciones</h2><p>Prueba con otra búsqueda o limpia los filtros.</p><Button type="button" variant="outline" onClick={clearFilters}>Limpiar filtros</Button></Card> : <InspectionsTable inspections={filteredInspections} />}</div> : null}
  </section>;
}

const s = {
  page: "mx-auto max-w-[1200px]",
  header: "space-y-1",
  heading: "flex flex-wrap items-center gap-3",
  title: "text-[32px] font-semibold tracking-tight",
  countBadge: "rounded-sm border-0 bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-secondary-foreground",
  subtitle: "text-sm text-secondary-foreground",
  workspace: "mt-6 space-y-6",
  filters: "flex flex-col gap-3 rounded-md border bg-card p-3 shadow-sm lg:flex-row lg:items-end",
  searchField: "relative block min-w-0 flex-1",
  srOnly: "sr-only",
  searchIcon: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-foreground",
  searchInput: "bg-secondary/60 pl-9",
  filterControls: "flex flex-col gap-3 sm:flex-row sm:items-end",
  filterField: "grid gap-1 font-mono text-[11px] font-medium uppercase tracking-[.05em] text-secondary-foreground",
  select: "h-10 rounded-md border border-input bg-secondary/60 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  clearButton: "h-10 self-end rounded-sm px-2 font-mono text-[11px] tracking-[.05em]",
  tableFrame: "overflow-hidden rounded-md border bg-card shadow-sm",
  tableScroll: "overflow-x-auto",
  table: "min-w-[1040px] w-full border-collapse text-left text-sm",
  tableHeader: "bg-secondary/70 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-secondary-foreground",
  tableRow: "border-t transition-colors hover:bg-secondary/30",
  tableCell: "px-4 py-4 align-middle text-sm text-secondary-foreground",
  folio: "font-mono text-xs font-semibold text-primary",
  laboratory: "font-semibold text-foreground",
  laboratoryCode: "mt-0.5 font-mono text-[11px] tracking-[.04em] text-secondary-foreground",
  resultAttention: "rounded-sm border-0 bg-destructive/15 px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive",
  resultClear: "rounded-sm border-0 bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-secondary-foreground",
  workflowCompleted: "rounded-sm border-0 bg-[#cfe4db] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#4f625b]",
  workflowDraft: "rounded-sm border-0 bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-secondary-foreground",
  syncComplete: "rounded-sm border-0 bg-[#cfe4db] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#4f625b]",
  syncPending: "rounded-sm border-0 bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-secondary-foreground",
  syncError: "rounded-sm border-0 bg-destructive/15 px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive",
  actionHeader: "block text-right",
  actionCell: "text-right",
  detailButton: "h-auto rounded-sm px-2 py-1 font-mono text-xs",
  loadingTable: "mt-6 space-y-3 p-4",
  loadingFilters: "h-10 animate-pulse rounded-sm bg-secondary",
  loadingRow: "h-16 animate-pulse rounded-sm bg-secondary",
  errorState: "mt-6 flex flex-col gap-3 p-6 sm:flex-row sm:items-center",
  errorIcon: "size-5 shrink-0 text-destructive",
  errorTitle: "font-semibold",
  errorDescription: "mt-1 text-sm text-secondary-foreground",
  retryButton: "sm:ml-auto",
  emptyState: "mt-6 p-8 text-center",
  emptyTitle: "font-semibold",
  emptyDescription: "mt-1 text-sm text-secondary-foreground",
  noResults: "space-y-3 p-6 text-center",
};
