"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCoordinationDashboard } from "../hooks/use-coordination-dashboard";
import type { CoordinationDashboard, DashboardInspection } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: number;
  tone?: "default" | "attention" | "pending";
}) {
  const isAttention = tone === "attention";
  return (
    <Card className={s.metricCard}>
      <div>
        <p className={isAttention ? s.metricLabelAttention : s.metricLabel}>{label}</p>
        <p className={isAttention ? s.metricValueAttention : s.metricValue}>{value}</p>
      </div>
      <span className={isAttention ? s.metricIconAttention : tone === "pending" ? s.metricIconPending : s.metricIcon}><Icon className={s.metricGlyph} aria-hidden="true" /></span>
    </Card>
  );
}

function InspectionRow({ inspection, attention = false }: { inspection: DashboardInspection; attention?: boolean }) {
  return (
    <article className={attention ? s.attentionRow : s.recentRow}>
      <div className={s.rowContent}>
        <h3 className={s.rowTitle}>{inspection.location}</h3>
        <p className={s.rowMeta}>{dateFormatter.format(new Date(`${inspection.date}T12:00:00`))} · {inspection.inspector}</p>
      </div>
      <div className={s.rowActions}>
        {attention ? <Badge className={s.attentionBadge}>{inspection.findingCount} hallazgo{inspection.findingCount === 1 ? "" : "s"}</Badge> : <Badge className={inspection.result === "requires_attention" ? s.attentionBadge : s.successBadge}>{inspection.result === "requires_attention" ? "Requiere atención" : "Sin incidencias"}</Badge>}
        <Button asChild className={s.detailButton} size="sm" variant="ghost"><Link href={`/inspections/${inspection.id}`} aria-label={`Ver detalle de ${inspection.location}`}>Ver detalle <ArrowRight className={s.detailIcon} aria-hidden="true" /></Link></Button>
      </div>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className={s.dashboardSkeleton} aria-label="Cargando resumen de coordinación">
      <div className={s.metrics}>
        <Card className={s.metricSkeleton} /><Card className={s.metricSkeleton} /><Card className={s.metricSkeleton} />
      </div>
      <div className={s.lowerSkeleton}><Card className={s.listSkeleton} /><Card className={s.listSkeleton} /></div>
    </div>
  );
}

export function CoordinationDashboardWorkspace({ dashboard }: { dashboard: CoordinationDashboard | undefined }) {
  const { state, retry } = useCoordinationDashboard(dashboard);

  return (
    <section className={s.page} aria-labelledby="dashboard-title">
      <header className={s.header}>
        <h1 id="dashboard-title" className={s.title}>Resumen de Coordinación</h1>
        <p className={s.subtitle}>Estado general de las inspecciones de laboratorios de cómputo.</p>
      </header>

      {state === "loading" ? <DashboardSkeleton /> : null}
      {state === "error" ? <Card className={s.errorState} role="alert"><CircleAlert className={s.errorIcon} aria-hidden="true" /><div><h2 className={s.errorTitle}>No fue posible cargar el resumen</h2><p className={s.errorDescription}>Intenta de nuevo para consultar las inspecciones.</p></div><Button className={s.retryButton} type="button" variant="outline" onClick={retry}>Reintentar</Button></Card> : null}
      {state === "empty" ? <Card className={s.emptyState}><ClipboardCheck className={s.emptyIcon} aria-hidden="true" /><h2 className={s.emptyTitle}>No hay inspecciones registradas</h2><p className={s.emptyDescription}>El resumen estará disponible cuando existan inspecciones para supervisar.</p></Card> : null}
      {state === "ready" && dashboard ? (
        <div className={s.dashboard}>
          <section className={s.metricsSection} aria-label="Métricas de coordinación">
            <div className={s.metrics}>
              <MetricCard icon={ClipboardCheck} label="Inspecciones realizadas" value={dashboard.summary.inspectionCount} />
              <MetricCard icon={AlertTriangle} label="Requieren atención" tone="attention" value={dashboard.summary.inspectionCountRequiringAttention} />
              <MetricCard icon={ListChecks} label="Hallazgos pendientes" tone="pending" value={dashboard.summary.pendingFindingCount} />
            </div>
          </section>

          <div className={s.lowerSections}>
            <section aria-labelledby="attention-title">
              <Card className={s.listCard}>
                <div className={s.listHeader}>
                  <h2 id="attention-title" className={s.listTitle}><span className={s.attentionDot} aria-hidden="true" />Inspecciones que requieren atención</h2>
                  <Badge className={s.priorityBadge}>{dashboard.summary.inspectionCountRequiringAttention} prioritarias</Badge>
                </div>
                {dashboard.attentionInspections.length === 0 ? <p className={s.positiveState}><CheckCircle2 className={s.positiveIcon} aria-hidden="true" />No hay hallazgos urgentes.</p> : <div className={s.rows}>{dashboard.attentionInspections.map((inspection) => <InspectionRow key={inspection.id} attention inspection={inspection} />)}</div>}
              </Card>
            </section>
            <section aria-labelledby="recent-title">
              <Card className={s.listCard}>
                <div className={s.listHeader}><h2 id="recent-title" className={s.listTitle}>Inspecciones recientes</h2></div>
                <div className={s.rows}>{dashboard.recentInspections.map((inspection) => <InspectionRow key={inspection.id} inspection={inspection} />)}</div>
              </Card>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const s = {
  page: "mx-auto max-w-[1200px]",
  header: "space-y-1",
  title: "text-[32px] font-semibold tracking-tight",
  subtitle: "text-sm text-secondary-foreground",
  dashboard: "mt-8 space-y-8",
  metricsSection: "self-start",
  metrics: "grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3",
  metricCard: "flex min-h-[124px] self-start items-center justify-between p-5 shadow-sm",
  metricLabel: "max-w-[12rem] font-mono text-[11px] font-medium uppercase tracking-[.05em] text-secondary-foreground",
  metricLabelAttention: "max-w-[12rem] font-mono text-[11px] font-medium uppercase tracking-[.05em] text-destructive",
  metricValue: "mt-1 text-[32px] font-semibold tracking-tight",
  metricValueAttention: "mt-1 text-[32px] font-semibold tracking-tight text-destructive",
  metricIcon: "grid size-12 shrink-0 place-items-center rounded-sm bg-secondary text-primary",
  metricIconAttention: "grid size-12 shrink-0 place-items-center rounded-sm bg-destructive/15 text-destructive",
  metricIconPending: "grid size-12 shrink-0 place-items-center rounded-sm bg-[#cfe4db] text-[#4f625b]",
  metricGlyph: "size-5",
  lowerSections: "grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)]",
  listCard: "space-y-3 p-5 shadow-sm",
  listHeader: "flex flex-wrap items-center justify-between gap-3 border-b pb-3",
  listTitle: "flex items-center gap-1 text-lg font-semibold",
  attentionDot: "size-2 rounded-full bg-destructive",
  priorityBadge: "rounded-sm border-0 bg-destructive/15 px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive",
  rows: "space-y-2",
  attentionRow: "flex flex-col gap-3 rounded-sm bg-secondary/70 p-3 sm:flex-row sm:items-center sm:justify-between",
  recentRow: "flex flex-col gap-3 rounded-sm bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between",
  rowContent: "min-w-0",
  rowTitle: "text-sm font-semibold",
  rowMeta: "mt-1 text-xs text-secondary-foreground",
  rowActions: "flex flex-wrap items-center gap-2",
  attentionBadge: "rounded-sm border-0 bg-destructive/15 px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive",
  successBadge: "rounded-sm border-0 bg-[#cfe4db] px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#4f625b]",
  detailButton: "h-auto rounded-sm px-2 py-1 font-mono text-xs",
  detailIcon: "ml-1 size-3",
  dashboardSkeleton: "mt-8 space-y-8",
  metricSkeleton: "min-h-[124px] self-start animate-pulse bg-secondary",
  lowerSkeleton: "grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)]",
  listSkeleton: "h-56 animate-pulse bg-secondary",
  errorState: "mt-8 flex flex-col gap-3 p-6 sm:flex-row sm:items-center",
  errorIcon: "size-5 shrink-0 text-destructive",
  errorTitle: "font-semibold",
  errorDescription: "mt-1 text-sm text-secondary-foreground",
  retryButton: "sm:ml-auto",
  emptyState: "mt-8 p-8 text-center",
  emptyIcon: "mx-auto size-7 text-secondary-foreground",
  emptyTitle: "mt-3 font-semibold",
  emptyDescription: "mt-1 text-sm text-secondary-foreground",
  positiveState: "flex items-center gap-2 rounded-sm bg-secondary p-4 text-sm text-secondary-foreground",
  positiveIcon: "size-4 shrink-0 text-[#4f625b]",
};
