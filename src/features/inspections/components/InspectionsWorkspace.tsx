"use client";

import { AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Input } from "@/components/ui/input";
import { InspectionLedger } from "./InspectionLedger";
import { useInspectionFilters } from "../hooks/use-inspection-filters";
import { useInspectionListState } from "../hooks/use-inspection-list-state";
import type { InspectionListItem } from "../types";

export function InspectionsWorkspace({ inspections }: { inspections: readonly InspectionListItem[] }) {
  const { query, result, status, filteredInspections, hasActiveFilters, clearFilters, setQuery, setResult, setStatus } = useInspectionFilters(inspections);
  const { state } = useInspectionListState({ records: filteredInspections, hasActiveFilters });
  return <section className={s.page} aria-labelledby="inspections-title">
    <header><h1 id="inspections-title" className={s.title}>Inspecciones</h1><p className={s.resultCount}>{filteredInspections.length} de {inspections.length} resultados</p></header>
    <Card className={s.filters}><label className={s.searchField}><span className={s.visuallyHidden}>Buscar inspecciones</span><Search className={s.searchIcon} /><Input className={s.searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por laboratorio" /></label><label className={s.resultFilter}><span>Resultado</span><select className={s.select} value={result} onChange={(event) => setResult(event.target.value as typeof result)}><option value="all">Todos</option><option value="without_findings">Sin incidencias</option><option value="requires_attention">Requiere atención</option></select></label><label className={s.statusFilter}><span>Estado</span><select className={s.select} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Todos</option><option value="draft">Borrador</option><option value="completed">Finalizada</option></select></label></Card>
    {state === "loading" ? <Card className={s.loadingState}>{Array.from({ length: 4 }, (_, index) => <div key={index} className={s.loadingRow} />)}</Card> : null}
    {state === "empty" ? <Card className={s.emptyState}><EmptyState title="Todavía no hay inspecciones" description="Las inspecciones aparecerán aquí cuando se registren." /></Card> : null}
    {state === "filtered-empty" ? <Card className={s.emptyState}><EmptyState title="No hay resultados" description="Prueba con otra búsqueda o limpia los filtros." /><Button variant="outline" className={s.stateAction} onClick={clearFilters}>Limpiar filtros</Button></Card> : null}
    {state === "error" ? <Card className={s.emptyState}><AlertCircle className={s.errorIcon} /><h2 className={s.errorTitle}>No se pudieron cargar las inspecciones</h2><Button className={s.stateAction} onClick={() => window.location.reload()}>Reintentar</Button></Card> : null}
    {state === "success" || state === "offline-with-data" ? <InspectionLedger inspections={filteredInspections} /> : null}
  </section>;
}

const s = {
  page: "mx-auto max-w-[1200px]",
  title: "text-[32px] font-semibold tracking-tight",
  resultCount: "mt-1 text-sm text-muted-foreground",
  filters: "mt-5 grid gap-3 border-0 p-3 shadow-sm lg:grid-cols-[minmax(14rem,1fr)_auto_auto]",
  searchField: "relative",
  visuallyHidden: "sr-only",
  searchIcon: "pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground",
  searchInput: "pl-9",
  resultFilter: "grid gap-1 text-xs text-muted-foreground sm:grid-cols-[auto_10rem] sm:items-center",
  statusFilter: "grid gap-1 text-xs text-muted-foreground sm:grid-cols-[auto_9rem] sm:items-center",
  select: "h-10 rounded-sm border bg-background px-2 text-sm text-foreground",
  loadingState: "mt-4 space-y-3 p-4",
  loadingRow: "h-20 animate-pulse rounded-sm bg-secondary",
  emptyState: "mt-4 p-8 text-center",
  stateAction: "mt-4",
  errorIcon: "mx-auto size-7 text-destructive",
  errorTitle: "mt-3 font-semibold",
};
