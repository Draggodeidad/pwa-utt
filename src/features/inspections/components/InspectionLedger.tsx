import { Badge } from "@/components/ui/badge";
import { ChevronRight, Cloud, CloudOff, FileText, UserRound } from "lucide-react";
import Link from "next/link";
import type { InspectionListItem } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function ResultBadge({ inspection }: { inspection: InspectionListItem }) {
  const requiresAttention = inspection.result === "requires_attention";
  return <Badge className={`rounded-sm border-0 px-1.5 py-0.5 font-mono text-[10px] font-medium ${requiresAttention ? "bg-emerald-100 text-emerald-900" : "bg-cyan-100 text-cyan-950"}`}>{requiresAttention ? "△ Requiere atención" : "◎ Sin incidencias"}</Badge>;
}

function SyncBadge({ status }: { status: InspectionListItem["syncStatus"] }) {
  const isPending = status === "pending" || status === "local";
  return <span className="inline-flex items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground"><CloudOff className="size-3" aria-hidden="true" />{isPending ? "Pendiente" : "Sincronizada"}</span>;
}

export function InspectionLedger({ inspections }: { inspections: readonly InspectionListItem[] }) {
  return <section className="overflow-hidden rounded-lg bg-secondary/50 shadow-sm" aria-labelledby="ledger-title">
    <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/70 px-4 py-3 font-mono text-[11px] text-muted-foreground"><h2 id="ledger-title" className="font-semibold text-foreground">LEDGER // 2026-Q3</h2><span className="hidden sm:inline">|</span><span>Libreta de Auditorías de Campus</span><span className="ml-auto">{inspections.length} de {inspections.length} elementos</span></header>
    <div className="space-y-3 p-3">
      {inspections.map((inspection) => <article key={inspection.id} className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm lg:grid-cols-[minmax(10rem,1.25fr)_minmax(10rem,1fr)_minmax(9rem,.8fr)_auto] lg:items-center">
        <div><div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground"><span>#{inspection.id.replace("inspection-", "INS-")}</span><span className="rounded-sm bg-secondary px-1 py-0.5 text-[9px] font-medium text-muted-foreground">{inspection.syncStatus === "pending" ? "OFFLINE" : "SYNC"}</span></div><h3 className="mt-2 text-sm font-semibold leading-snug">{inspection.location}</h3></div>
        <div className="space-y-2 text-xs text-muted-foreground"><span className="inline-block rounded-sm bg-secondary px-1.5 py-1 font-mono text-[10px] text-secondary-foreground">{inspection.laboratoryCode}</span><p className="flex items-center gap-1"><FileText className="size-3.5" aria-hidden="true" />{dateFormatter.format(new Date(`${inspection.date}T12:00:00`))}</p><p className="flex items-center gap-1"><UserRound className="size-3.5" aria-hidden="true" />{inspection.inspector}</p></div>
        <div className="flex flex-wrap gap-1.5 lg:flex-col lg:items-start"><ResultBadge inspection={inspection} /><span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">{inspection.findingCount} hallazgos</span><SyncBadge status={inspection.syncStatus} /></div>
        <Link href={`/inspections/${inspection.id}`} aria-label={`Abrir detalle de ${inspection.location}`} className="justify-self-end rounded-sm p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="size-5" aria-hidden="true" /></Link>
      </article>)}
    </div>
    <footer className="flex flex-wrap items-center gap-3 border-t border-border/70 px-4 py-3 font-mono text-[10px] text-muted-foreground"><span>Mostrando 1 - {inspections.length} de {inspections.length} registros verificados</span><div className="ml-auto flex gap-1"><button type="button" disabled className="rounded-sm bg-card px-2 py-1 disabled:opacity-60">Anterior</button><button type="button" disabled className="rounded-sm bg-card px-2 py-1 disabled:opacity-60">Siguiente</button></div></footer>
  </section>;
}
