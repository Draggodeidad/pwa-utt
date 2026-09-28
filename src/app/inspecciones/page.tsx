"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/loading-state";
import { Input } from "@/components/ui/input";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { inspections, useInspectionFilters } from "@/features/inspections";
import type { InspectionListItem } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";

type InspectionsPageProps = {
  searchParams?: { estado?: string };
};

type ListPhase = "loading" | "ready" | "error";

export default function InspeccionesPage({ searchParams }: InspectionsPageProps) {
  const { user } = temporarySession;
  const demoState = searchParams?.estado;
  const [phase, setPhase] = useState<ListPhase>(() => demoState === "error" ? "error" : demoState === "vacio" ? "ready" : "loading");
  const [records, setRecords] = useState<readonly InspectionListItem[]>([]);
  const { query, result, filteredInspections, hasActiveFilters, clearFilters, setQuery, setResult } = useInspectionFilters(records);

  useEffect(() => {
    if (demoState === "error") { setRecords([]); setPhase("error"); return; }
    if (demoState === "vacio") { setRecords([]); setPhase("ready"); return; }
    if (demoState === "cargando") { setRecords([]); setPhase("loading"); return; }
    let active = true;
    setPhase("loading");
    // The in-memory adapter is asynchronous so the client route has an observable loading transition.
    Promise.resolve(inspections).then((items) => {
      if (!active) return;
      setRecords(items);
      setPhase("ready");
    }).catch(() => {
      if (active) setPhase("error");
    });
    return () => { active = false; };
  }, [demoState]);

  function retry() {
    setPhase("loading");
    Promise.resolve(inspections).then((items) => {
      setRecords(items);
      setPhase("ready");
    }).catch(() => setPhase("error"));
  }

  return (
    <AppShell activePath="/inspecciones" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <section aria-labelledby="inspecciones-title" className={s.page}>
        <header className={s.header}>
          <div>
            <p className={s.eyebrow}>Registros de ejemplo</p>
            <h1 id="inspecciones-title" className={s.title}>Inspecciones</h1>
            <p className={s.description}>Consulta los registros sintéticos de los laboratorios y revisa su información detallada.</p>
          </div>
          {phase === "ready" ? <p className={s.count} aria-label={`${records.length} inspecciones registradas`}><ClipboardList aria-hidden="true" className={s.countIcon} />{records.length} registradas</p> : null}
        </header>

        {phase === "loading" ? <div className={s.feedback}><LoadingState headingLevel={2} /></div> : null}
        {phase === "error" ? <div className={s.feedback}><LoadingState state="error" headingLevel={2} action={<button className={s.retryButton} onClick={retry} type="button">Volver a intentar</button>} /></div> : null}
        {phase === "ready" && records.length === 0 ? <div className={s.feedback}><LoadingState state="empty" headingLevel={2} /></div> : null}
        {phase === "ready" && records.length > 0 ? (
          <>
            <div className={s.filters}>
              <label className={s.searchField} htmlFor="inspection-search"><Search aria-hidden="true" className={s.searchIcon} /><span className={s.visuallyHidden}>Buscar inspecciones</span></label>
              <Input className={s.searchInput} id="inspection-search" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por laboratorio o responsable" type="search" value={query} />
              <label className={s.resultLabel} htmlFor="inspection-result">Resultado</label>
              <select className={s.resultSelect} id="inspection-result" onChange={(event) => setResult(event.target.value as typeof result)} value={result}>
                <option value="all">Todos</option>
                <option value="without_findings">Sin incidencias</option>
                <option value="requires_attention">Requiere atención</option>
              </select>
            </div>
            <p className={s.resultsCount} role="status">{filteredInspections.length} de {records.length} resultados</p>
            {filteredInspections.length === 0 ? <LoadingState state="empty" headingLevel={2} title="No hay resultados" description="Prueba con otra búsqueda o limpia los filtros." action={hasActiveFilters ? <button className={s.retryButton} onClick={clearFilters} type="button">Limpiar filtros</button> : undefined} /> : (
              <ul className={s.list} aria-label="Listado de inspecciones">
                {filteredInspections.map((inspection) => (
                  <li key={inspection.id}>
                    <Link className={s.card} href={`/inspecciones/${inspection.id}`}>
                      <div className={s.cardMain}>
                        <div className={s.cardHeading}>
                          <span className={`${s.resultBadge} ${inspection.result === "without_findings" ? s.resultSuccess : s.resultWarning}`}>
                            {inspection.result === "without_findings" ? "Sin incidencias" : "Requiere atención"}
                          </span>
                          <span className={s.code}>{inspection.laboratoryCode}</span>
                        </div>
                        <h2 className={s.cardTitle}>{inspection.location}</h2>
                        <p className={s.summary}>{inspection.summary}</p>
                        <dl className={s.metadata}>
                          <div className={s.metadataItem}><dt className={s.metadataLabel}><CalendarDays aria-hidden="true" className={s.metadataIcon} />Fecha</dt><dd>{formatDate(inspection.date)}</dd></div>
                          <div className={s.metadataItem}><dt className={s.metadataLabel}><UserRound aria-hidden="true" className={s.metadataIcon} />Responsable</dt><dd>{inspection.inspector}</dd></div>
                          <div className={s.metadataItem}><dt className={s.metadataLabel}>Hallazgos</dt><dd>{inspection.findingCount === 0 ? "Sin hallazgos" : `${inspection.findingCount} registrados`}</dd></div>
                        </dl>
                      </div>
                      <ChevronRight aria-hidden="true" className={s.cardArrow} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </section>
    </AppShell>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`));
}

const s = {
  page: "mx-auto max-w-5xl",
  header: "flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between",
  eyebrow: "font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground",
  title: "mt-2 text-3xl font-semibold tracking-tight text-foreground",
  description: "mt-2 max-w-2xl text-sm leading-6 text-muted-foreground",
  count: "inline-flex shrink-0 items-center gap-2 rounded-sm bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground",
  countIcon: "size-4",
  feedback: "mt-6",
  filters: "mt-6 grid gap-2 rounded-lg border bg-card p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_11rem] sm:items-center",
  searchField: "flex items-center",
  searchIcon: "size-4 text-muted-foreground",
  visuallyHidden: "sr-only",
  searchInput: "w-full",
  resultLabel: "text-sm text-secondary-foreground",
  resultSelect: "h-10 rounded-sm border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  resultsCount: "mt-4 text-sm text-muted-foreground",
  list: "mt-3 space-y-3",
  card: "group flex items-start gap-4 rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  cardMain: "min-w-0 flex-1",
  cardHeading: "flex flex-wrap items-center gap-2",
  resultBadge: "rounded-sm px-2 py-1 text-xs font-medium",
  resultSuccess: "bg-emerald-100 text-emerald-800",
  resultWarning: "bg-amber-100 text-amber-900",
  code: "font-mono text-xs text-muted-foreground",
  cardTitle: "mt-3 text-lg font-semibold leading-tight text-foreground",
  summary: "mt-1 text-sm leading-6 text-muted-foreground",
  metadata: "mt-4 grid gap-3 border-t pt-3 text-sm text-secondary-foreground sm:grid-cols-3",
  metadataItem: "min-w-0",
  metadataLabel: "mb-1 flex items-center gap-1 text-xs text-muted-foreground",
  metadataIcon: "size-3.5",
  cardArrow: "mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5",
  retryButton: "inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
};
