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
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-0 p-6 sm:p-8" onPointerDownOutside={(event) => submitting && event.preventDefault()} onEscapeKeyDown={(event) => submitting && event.preventDefault()}>
    <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#cae8e8] text-primary"><FileCheck2 className="size-5" aria-hidden="true" /></span><div><p className="font-mono text-[10px] font-medium uppercase tracking-[.08em] text-secondary-foreground">Acción de cierre irrevocable</p><DialogTitle className="mt-0.5 text-xl font-semibold">Finalizar inspección</DialogTitle></div></div>
    <DialogDescription className="text-sm leading-6 text-secondary-foreground">La inspección de la sala de cómputo quedará cerrada como documento definitivo.</DialogDescription>
    <dl className="space-y-1.5 rounded-sm bg-secondary p-3 text-[13px]"><div className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-3"><dt className="text-secondary-foreground">Identificador:</dt><dd className="font-mono font-semibold">#{folio} ({laboratory})</dd></div><div className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-3"><dt className="text-secondary-foreground">Hallazgos levantados:</dt><dd className="font-medium">{findings.length} ítems ({high} alta prioridad, {medium} media)</dd></div><div className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-3"><dt className="text-secondary-foreground">Cola de transmisión:</dt><dd className="font-mono text-[11px]">{syncStatus === "pending" ? "Local IndexedDB -> Cloud Sync" : "Sincronizado"}</dd></div></dl>
    <p className="flex gap-2 font-mono text-[11px] leading-5 text-secondary-foreground"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Una vez finalizada, requerirá privilegios de Coordinación para reapertura.</p>
    {error ? <p role="alert" className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">No fue posible finalizar la inspección. Intenta de nuevo.</p> : null}
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-sm px-6 font-mono text-[11px]" disabled={submitting} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" className="rounded-sm px-6 font-mono text-[11px]" disabled={submitting} onClick={onConfirm}>{submitting ? "Finalizando..." : "Confirmar y finalizar"}</Button></div>
  </DialogContent></Dialog>;
}
