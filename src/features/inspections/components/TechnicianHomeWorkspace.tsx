"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, ClipboardPenLine, CloudOff, RefreshCw } from "lucide-react";
import { AppShellState } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useInspectionListState } from "../hooks/use-inspection-list-state";
import type { InspectionListItem } from "../types";

type Props = { inspections: readonly InspectionListItem[]; technicianName: string; isLoading?: boolean; error?: Error | null };
const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card className={s.metric}><div><p className={s.metricLabel}>{label}</p><p className={s.metricValue}>{value}</p></div><span className={s.metricIcon}>{icon}</span></Card>;
}

export function TechnicianHomeWorkspace({ inspections, technicianName, isLoading = false, error = null }: Props) {
  const { state, connectivity } = useInspectionListState({ records: inspections, hasActiveFilters: false, isLoading, error });
  const attention = inspections.filter((item) => item.result === "requires_attention").length;
  const pending = inspections.filter((item) => item.syncStatus !== "synced").length;
  return <section className={s.page} aria-labelledby="home-title">
    {connectivity === "offline" ? <p className={s.offlineNotice} role="status"><CloudOff className={s.icon} />Sin conexión. Se muestran los registros guardados localmente.</p> : null}
    <header className={s.header}><div><h1 id="home-title" className={s.title}>Buen día, {technicianName}</h1><p className={s.subtitle}>Consulta el estado de tus inspecciones recientes.</p></div><Button asChild className={s.newInspectionButton}><Link href="/inspections/new"><ClipboardPenLine className={s.buttonIcon} />Nueva inspección</Link></Button></header>
    <div className={s.metrics}><Metric label="Inspecciones" value={inspections.length} icon={<CheckCircle2 className={s.metricGlyph} />} /><Metric label="Requieren atención" value={attention} icon={<AlertCircle className={s.metricGlyph} />} /><Metric label="Pendientes de sincronización" value={pending} icon={<RefreshCw className={s.metricGlyph} />} /></div>
    <div className={s.recentHeader}><h2 className={s.sectionTitle}>Inspecciones recientes</h2><Link href="/inspections" className={s.viewAll}>Ver todas <ArrowRight className={s.icon} /></Link></div>
    {state === "loading" ? <AppShellState state="loading" /> : null}
    {state === "empty" ? <AppShellState state="empty" title="Todavía no hay inspecciones" description="Crea la primera inspección para comenzar." /> : null}
    {state === "error" ? <AppShellState state="error" title="No se pudieron cargar las inspecciones" description="Comprueba la conexión e inténtalo nuevamente." onRetry={() => window.location.reload()} /> : null}
    {state === "success" || state === "offline-with-data" ? <div className={s.recentList}>{inspections.slice(0, 4).map((inspection) => <article key={inspection.id} className={s.recentRow}><div><p className={s.folio}>#{inspection.id.replace("inspection-", "INS-")}</p><h3 className={s.location}>{inspection.location}</h3></div><time className={s.date} dateTime={inspection.date}>{dateFormatter.format(new Date(`${inspection.date}T12:00:00`))}</time><p className={s.findings}>{inspection.findingCount ? `${inspection.findingCount} hallazgos` : "Sin hallazgos"}</p><Button asChild variant="ghost" size="icon" className={s.openButton}><Link href={`/inspections/${inspection.id}`} aria-label={`Abrir ${inspection.location}`}><ChevronRight className={s.icon} /></Link></Button></article>)}</div> : null}
  </section>;
}

const s = {
  metric: "flex items-center justify-between border-0 p-4 shadow-sm",
  metricLabel: "text-sm text-muted-foreground",
  metricValue: "mt-1 text-2xl font-semibold",
  metricIcon: "grid size-10 place-items-center rounded-sm bg-secondary text-secondary-foreground",
  page: "mx-auto max-w-[1200px]",
  offlineNotice: "mb-5 flex items-center gap-2 rounded-sm bg-secondary px-3 py-2 text-xs text-secondary-foreground",
  icon: "size-4",
  header: "flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between",
  title: "text-[32px] font-semibold leading-10 tracking-tight",
  subtitle: "mt-1 text-secondary-foreground",
  newInspectionButton: "rounded-sm",
  buttonIcon: "mr-2 size-4",
  metrics: "grid gap-3 sm:grid-cols-3",
  metricGlyph: "size-5",
  recentHeader: "mt-8 flex items-center justify-between",
  sectionTitle: "text-xl font-semibold",
  viewAll: "inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline",
  recentList: "mt-3 overflow-hidden rounded-lg bg-card shadow-sm",
  recentRow: "grid gap-2 border-b px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_2rem] sm:items-center",
  folio: "font-mono text-[10px] text-muted-foreground",
  location: "text-sm font-semibold",
  date: "text-xs text-muted-foreground",
  findings: "text-xs",
  openButton: "size-8",
};
