import Link from "next/link";
import { ChevronRight, CloudOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InspectionListItem } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

export function InspectionLedger({ inspections }: { inspections: readonly InspectionListItem[] }) {
  return <div className={s.list}>{inspections.map((inspection) => <article key={inspection.id} className={s.row}><div><p className={s.folio}>#{inspection.id.replace("inspection-", "INS-")}</p><h2 className={s.location}>{inspection.location}</h2></div><time className={s.date} dateTime={inspection.date}>{dateFormatter.format(new Date(`${inspection.date}T12:00:00`))}</time><Badge className={`${s.resultBadge} ${inspection.result === "requires_attention" ? s.resultRequiresAttention : s.resultWithoutFindings}`}>{inspection.result === "requires_attention" ? "Requiere atención" : "Sin incidencias"}</Badge><div className={s.findings}><p>{inspection.findingCount} hallazgo{inspection.findingCount === 1 ? "" : "s"}</p>{inspection.syncStatus !== "synced" ? <p className={s.syncPending}><CloudOff className={s.syncIcon} />Pendiente</p> : null}</div><Button asChild variant="ghost" size="icon" className={s.openButton}><Link href={`/inspections/${inspection.id}`} aria-label={`Abrir detalle de ${inspection.location}`}><ChevronRight className={s.openIcon} /></Link></Button></article>)}</div>;
}

const s = {
  list: "mt-4 space-y-3",
  row: "grid gap-3 rounded-lg bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1.4fr)_8rem_9rem_7rem_2rem] sm:items-center",
  folio: "font-mono text-[10px] text-muted-foreground",
  location: "mt-1 text-sm font-semibold",
  date: "text-xs text-muted-foreground",
  resultBadge: "w-fit rounded-sm border-0",
  resultRequiresAttention: "bg-amber-100 text-amber-900",
  resultWithoutFindings: "bg-emerald-100 text-emerald-900",
  findings: "text-xs",
  syncPending: "mt-1 flex items-center gap-1 text-muted-foreground",
  syncIcon: "size-3",
  openButton: "size-8",
  openIcon: "size-4",
};
