"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, CircleDashed, ClipboardPenLine, Cloud, CloudOff, FileClock, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useInspectionListState } from "../hooks/use-inspection-list-state";
import type { InspectionListItem, TechnicianHomeData } from "../types";

type TechnicianHomeWorkspaceProps = {
  readonly inspections: readonly InspectionListItem[];
  readonly data: TechnicianHomeData;
  readonly technicianName: string;
  readonly isLoading?: boolean;
  readonly error?: Error | null;
};

const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function SyncLabel({ status }: { status: InspectionListItem["syncStatus"] }) {
  if (status === "synced") return null;
  const label = status === "error" ? "Error de sincronización" : status === "syncing" ? "Sincronizando" : "Pendiente de sincronizar";
  return <span className="rounded-sm bg-secondary px-1 py-0.5 font-mono text-[10px] text-secondary-foreground">{label}</span>;
}

function RecentInspectionRow({ inspection }: { inspection: InspectionListItem }) {
  const needsAttention = inspection.result === "requires_attention";
  const isDraft = inspection.workflowStatus === "draft";

  return (
    <article className="grid gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(9rem,1fr)_7rem_1rem] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1"><span className="font-mono text-[10px] tracking-wide text-muted-foreground">{inspection.laboratoryCode}</span><SyncLabel status={inspection.syncStatus} /></div>
        <h3 className="mt-1 text-sm font-semibold leading-tight text-foreground">{inspection.location}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{inspection.summary}</p>
      </div>
      <time dateTime={inspection.date} className="font-mono text-[11px] text-muted-foreground">{dateFormatter.format(new Date(`${inspection.date}T12:00:00`))}</time>
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium text-foreground"><span aria-hidden="true">{isDraft ? "⌁" : needsAttention ? "△" : "◎"}</span>{isDraft ? "Borrador" : needsAttention ? "Requiere atención" : "Sin incidencias"}</p>
      <p className="font-mono text-[10px] text-foreground sm:text-right">{inspection.findingCount} {inspection.findingCount === 1 ? "hallazgo" : "hallazgos"}</p>
      <button type="button" aria-label={`Abrir ${inspection.location}`} className="justify-self-end rounded-sm p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="size-4" aria-hidden="true" /></button>
    </article>
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Card className="flex min-w-0 items-center justify-between rounded-lg border-0 p-4 shadow-sm"><div><p className="font-mono text-[10px] font-medium uppercase tracking-[.08em] text-secondary-foreground">{label}</p><p className="mt-1 text-[19px] font-semibold leading-6 tracking-tight">{value}</p><p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{detail}</p></div>{icon}</Card>;
}

export function TechnicianHomeWorkspace({ inspections, data, technicianName, isLoading = false, error = null }: TechnicianHomeWorkspaceProps) {
  const { state, connectivity } = useInspectionListState({ records: inspections, hasActiveFilters: false, isLoading, error });
  const recentInspections = inspections.slice(0, 4);
  const requiresAttention = inspections.filter((item) => item.result === "requires_attention").length;
  const pendingSync = inspections.filter((item) => item.syncStatus !== "synced").length;
  const percent = Math.round((data.route.completedRooms / data.route.totalRooms) * 100);

  return <section className="mx-auto max-w-[1200px]" aria-labelledby="home-title">
    <div className={`mb-6 flex items-center justify-between gap-3 rounded-sm px-4 py-1.5 shadow-sm ${connectivity === "offline" ? "bg-secondary text-secondary-foreground" : "border border-border bg-card text-muted-foreground"}`} role="status">
      <span className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.08em]"><span className={`size-2 rounded-full ${connectivity === "offline" ? "bg-secondary-foreground" : "bg-emerald-700"}`} aria-hidden="true" />{connectivity === "offline" ? "Sin conexión · mostrando datos guardados" : "En línea · registros disponibles"}</span>
      <span className="hidden items-center gap-1 font-mono text-[11px] sm:flex">{connectivity === "offline" ? <WifiOff className="size-3.5" aria-hidden="true" /> : <Cloud className="size-3.5" aria-hidden="true" />}{connectivity === "offline" ? "Copia local" : "Sincronización activa"}</span>
    </div>

    <header className="grid gap-5 pb-10 lg:grid-cols-12 lg:items-end">
      <div className="lg:col-span-8"><p className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-secondary-foreground">Estación técnica activa <span className="mx-1 text-muted-foreground">/</span> ID: {data.technicianId}</p><h1 id="home-title" className="mt-1 text-[32px] font-semibold leading-10 tracking-tight">Buen día, {technicianName}</h1><p className="mt-1 text-base text-secondary-foreground">{inspections.length} inspecciones <span aria-hidden="true">·</span> <strong className="font-semibold text-foreground">{requiresAttention} requieren atención</strong></p></div>
      <div className="flex flex-col items-start gap-2 lg:col-span-4 lg:items-end"><Button asChild className="h-9 rounded-sm px-6 font-mono text-[11px] tracking-[.08em]"><Link href="/inspections/new"><ClipboardPenLine className="mr-2 size-3.5" aria-hidden="true" />Nueva inspección</Link></Button><p className="font-mono text-[10px] text-muted-foreground">Libreta activa: {data.activeNotebook}</p></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard label="Estatus de ruta" value={`${data.route.completedRooms} de ${data.route.totalRooms} aulas`} detail={data.route.description} icon={<div className="grid size-12 place-items-center rounded-full border-4 border-secondary text-xs font-semibold text-secondary-foreground" aria-label={`${percent}% completado`}><span>{percent}%</span></div>} />
      <MetricCard label="Hallazgos no resueltos" value={`${String(requiresAttention).padStart(2, "0")} críticos`} detail="Requieren seguimiento" icon={<span className="grid size-12 place-items-center rounded-sm bg-secondary"><AlertCircle className="size-5 text-secondary-foreground" aria-hidden="true" /></span>} />
      <MetricCard label="Cola de transferencia" value={`${pendingSync} registros`} detail={pendingSync ? "A la espera de enlace" : "Todo sincronizado"} icon={<span className="grid size-12 place-items-center rounded-sm bg-secondary"><RefreshCw className="size-5 text-secondary-foreground" aria-hidden="true" /></span>} />
    </div>

    <div className="mt-10 flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight">Recientes</h2><span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">HOJA 01 / 04</span><p className="ml-auto font-mono text-[10px] uppercase tracking-[.08em] text-muted-foreground">Registro cronológico descendente</p></div>
    {state === "loading" ? <Card className="mt-3 space-y-3 rounded-lg border-0 p-4" aria-label="Cargando inspecciones">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-sm bg-secondary" />)}</Card> : null}
    {state === "empty" ? <Card className="mt-3 rounded-lg p-8 text-center"><EmptyState title="Todavía no hay inspecciones" description="Las inspecciones de salas de cómputo aparecerán aquí cuando se registren." /></Card> : null}
    {state === "error" ? <Card className="mt-3 rounded-lg p-8 text-center"><AlertCircle className="mx-auto size-7 text-destructive" aria-hidden="true" /><h2 className="mt-3 font-semibold">No se pudo cargar el inicio</h2><p className="mt-1 text-sm text-muted-foreground">Intenta nuevamente cuando la conexión esté disponible.</p><Button className="mt-4" onClick={() => window.location.reload()}>Reintentar</Button></Card> : null}
    {state === "offline-with-data" ? <p className="mt-3 flex items-center gap-2 rounded-sm bg-secondary px-3 py-2 text-xs text-secondary-foreground"><CloudOff className="size-4" aria-hidden="true" />Sin conexión. Se muestran los registros locales disponibles.</p> : null}
    {state === "success" || state === "offline-with-data" ? <section className="mt-3 overflow-hidden rounded-lg bg-card shadow-sm" aria-label="Inspecciones recientes"><div className="hidden grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(9rem,1fr)_7rem_1rem] gap-3 bg-secondary/70 px-4 py-2 font-mono text-[9px] uppercase tracking-[.08em] text-secondary-foreground sm:grid"><span>Laboratorio y espacio</span><span>Fecha</span><span>Resultado / estado</span><span className="text-right">Hallazgos</span><span /></div>{recentInspections.map((inspection) => <RecentInspectionRow key={inspection.id} inspection={inspection} />)}</section> : null}
    <div className="mt-4 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center"><p className="flex items-center gap-1.5 font-mono text-[10px]"><CheckCircle2 className="size-3.5" aria-hidden="true" />Firmado digitalmente: {technicianName} · ID #{data.technicianId}</p><Link href="/inspections" className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[.08em] text-primary underline-offset-4 hover:underline sm:ml-auto">Ver todas las inspecciones <ArrowRight className="size-3.5" aria-hidden="true" /></Link></div>

    <Card className="mt-10 grid gap-4 rounded-lg border-0 bg-secondary/45 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div><p className="font-mono text-[10px] uppercase tracking-[.08em] text-muted-foreground">Próximo punto asignado</p><h2 className="mt-1 text-base font-semibold">{data.upcomingStop.location} <span className="font-mono text-[11px] font-medium">({data.upcomingStop.laboratoryCode})</span></h2><p className="mt-1 max-w-2xl text-xs leading-5 text-secondary-foreground">{data.upcomingStop.description}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-sm bg-card px-2 py-1 font-mono text-[10px]">{data.upcomingStop.schedule}</span><span className="rounded-sm bg-card px-2 py-1 font-mono text-[10px]">{data.upcomingStop.building}</span></div></div><span className="grid size-16 place-items-center rounded-sm bg-card text-secondary-foreground"><FileClock className="size-7" aria-hidden="true" /></span></Card>
  </section>;
}
