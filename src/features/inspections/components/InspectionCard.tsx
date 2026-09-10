import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Check, CloudOff, RefreshCw } from "lucide-react";
import type { InspectionListItem } from "../types";

const resultLabels = {
  without_findings: "Sin incidencias",
  requires_attention: "Requiere atención"
} as const;

export function InspectionCard({ inspection }: { inspection: InspectionListItem }) {
  const tone = inspection.result === "without_findings" ? "success" : "warning";
  const badgeClassName = tone === "success" ? s.badgeSuccess : s.badgeWarning;
  const sync = inspection.syncStatus === "synced"
    ? { label: "Sincronizada", icon: Check, className: s.syncSuccess }
    : inspection.syncStatus === "error"
      ? { label: "Error al sincronizar", icon: AlertTriangle, className: s.syncError }
      : inspection.syncStatus === "syncing"
        ? { label: "Sincronizando", icon: RefreshCw, className: s.syncPending }
        : { label: "Pendiente de sincronizar", icon: CloudOff, className: s.syncPending };
  const SyncIcon = sync.icon;

  return (
    <Card className={s.card}>
      <div className={s.cardHeader}>
        <div className={s.summary}>
          <div className={s.statuses}>
            <Badge className={badgeClassName}>{resultLabels[inspection.result]}</Badge>
            <span className={`${s.syncStatus} ${sync.className}`}><SyncIcon className={s.syncIcon} aria-hidden="true" />{sync.label}</span>
          </div>
          <h3 className={s.title}>{inspection.location}</h3>
          <p className={s.description}>{inspection.summary}</p>
        </div>
        <time dateTime={inspection.date} className={s.date}>{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(`${inspection.date}T12:00:00`))}</time>
      </div>
      <dl className={s.details}>
        <div className={s.detail}><dt className={s.detailLabel}>Técnico responsable</dt><dd className={s.detailValue}>{inspection.inspector}</dd></div>
        <div className={s.detail}><dt className={s.detailLabel}>Hallazgos</dt><dd className={s.detailValue}>{inspection.findingCount === 0 ? "Sin hallazgos" : `${inspection.findingCount} pendientes`}</dd></div>
      </dl>
    </Card>
  );
}

const s = {
  card: "rounded-lg border-border p-4 shadow-sm transition-shadow hover:shadow-md",
  cardHeader: "grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start",
  summary: "min-w-0",
  statuses: "flex flex-wrap items-center gap-2",
  badgeSuccess: "border-0 bg-emerald-100 text-emerald-800",
  badgeWarning: "border-0 bg-amber-100 text-amber-900",
  syncStatus: "inline-flex items-center gap-1 text-xs",
  syncSuccess: "text-emerald-800",
  syncError: "text-destructive",
  syncPending: "text-muted-foreground",
  syncIcon: "size-3.5",
  title: "mt-3 text-lg font-semibold leading-tight text-foreground",
  description: "mt-1 text-sm text-muted-foreground",
  date: "font-mono text-xs text-muted-foreground",
  details: "mt-4 grid gap-2 border-t pt-3 text-sm sm:grid-cols-2",
  detail: "flex justify-between gap-3 sm:block",
  detailLabel: "text-xs text-muted-foreground",
  detailValue: "font-medium text-foreground sm:mt-1",
};
