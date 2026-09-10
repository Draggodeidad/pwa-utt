"use client";

import { FileCheck2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { InspectionFinding, SyncStatus } from "../types";

type InspectionFinalizationDialogProps = {
  open: boolean;
  submitting?: boolean;
  error?: boolean;
  folio: string;
  laboratory: string;
  findings: readonly InspectionFinding[];
  syncStatus: SyncStatus;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function InspectionFinalizationDialog({ open, submitting = false, error = false, folio, laboratory, findings, syncStatus, onOpenChange, onConfirm }: InspectionFinalizationDialogProps) {
  const high = findings.filter((finding) => finding.priority === "high").length;
  const medium = findings.filter((finding) => finding.priority === "medium").length;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={s.content} onPointerDownOutside={(event) => submitting && event.preventDefault()} onEscapeKeyDown={(event) => submitting && event.preventDefault()}>
    <div className={s.header}><span className={s.headerIcon}><FileCheck2 className={s.icon} aria-hidden="true" /></span><div><p className={s.eyebrow}>Acción de cierre irrevocable</p><DialogTitle className={s.title}>Finalizar inspección</DialogTitle></div></div>
    <DialogDescription className={s.description}>La inspección de la sala de cómputo quedará cerrada como documento definitivo.</DialogDescription>
    <dl className={s.summary}><div className={s.summaryRow}><dt className={s.summaryLabel}>Identificador:</dt><dd className={s.folio}>#{folio} ({laboratory})</dd></div><div className={s.summaryRow}><dt className={s.summaryLabel}>Hallazgos levantados:</dt><dd className={s.summaryValue}>{findings.length} ítems ({high} alta prioridad, {medium} media)</dd></div><div className={s.summaryRow}><dt className={s.summaryLabel}>Cola de transmisión:</dt><dd className={s.syncStatus}>{syncStatus === "pending" ? "Local IndexedDB -> Cloud Sync" : "Sincronizado"}</dd></div></dl>
    <p className={s.notice}><Info className={s.noticeIcon} aria-hidden="true" />Una vez finalizada, requerirá privilegios de Coordinación para reapertura.</p>
    {error ? <p role="alert" className={s.error}>No fue posible finalizar la inspección. Intenta de nuevo.</p> : null}
    <div className={s.actions}><Button type="button" variant="outline" className={s.action} disabled={submitting} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" className={s.action} disabled={submitting} onClick={onConfirm}>{submitting ? "Finalizando..." : "Confirmar y finalizar"}</Button></div>
  </DialogContent></Dialog>;
}

const s = {
  content: "max-h-[calc(100dvh-2rem)] overflow-y-auto border-0 p-6 sm:p-8",
  header: "flex gap-3",
  headerIcon: "grid size-10 shrink-0 place-items-center rounded-xl bg-[#cae8e8] text-primary",
  icon: "size-5",
  eyebrow: "font-mono text-[10px] font-medium uppercase tracking-[.08em] text-secondary-foreground",
  title: "mt-0.5 text-xl font-semibold",
  description: "text-sm leading-6 text-secondary-foreground",
  summary: "space-y-1.5 rounded-sm bg-secondary p-3 text-[13px]",
  summaryRow: "flex flex-col justify-between gap-1 sm:flex-row sm:gap-3",
  summaryLabel: "text-secondary-foreground",
  folio: "font-mono font-semibold",
  summaryValue: "font-medium",
  syncStatus: "font-mono text-[11px]",
  notice: "flex gap-2 font-mono text-[11px] leading-5 text-secondary-foreground",
  noticeIcon: "mt-0.5 size-3.5 shrink-0",
  error: "rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
  actions: "flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end",
  action: "rounded-sm px-6 font-mono text-[11px]",
};
