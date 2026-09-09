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
  const badgeClassName = tone === "success" ? "border-0 bg-emerald-100 text-emerald-800" : "border-0 bg-amber-100 text-amber-900";
  const sync = inspection.syncStatus === "synced"
    ? { label: "Sincronizada", icon: Check, className: "text-emerald-800" }
    : inspection.syncStatus === "error"
      ? { label: "Error al sincronizar", icon: AlertTriangle, className: "text-destructive" }
      : inspection.syncStatus === "syncing"
        ? { label: "Sincronizando", icon: RefreshCw, className: "text-muted-foreground" }
        : { label: "Pendiente de sincronizar", icon: CloudOff, className: "text-muted-foreground" };
  const SyncIcon = sync.icon;

  return (
    <Card className="rounded-lg border-border p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={badgeClassName}>{resultLabels[inspection.result]}</Badge>
            <span className={`inline-flex items-center gap-1 text-xs ${sync.className}`}><SyncIcon className="size-3.5" aria-hidden="true" />{sync.label}</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-tight text-foreground">{inspection.location}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{inspection.summary}</p>
        </div>
        <time dateTime={inspection.date} className="font-mono text-xs text-muted-foreground">{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(`${inspection.date}T12:00:00`))}</time>
      </div>
      <dl className="mt-4 grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">Técnico responsable</dt><dd className="font-medium text-foreground sm:mt-1">{inspection.inspector}</dd></div>
        <div className="flex justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">Hallazgos</dt><dd className="font-medium text-foreground sm:mt-1">{inspection.findingCount === 0 ? "Sin hallazgos" : `${inspection.findingCount} pendientes`}</dd></div>
      </dl>
    </Card>
  );
}
