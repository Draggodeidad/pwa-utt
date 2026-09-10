"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  Edit3,
  ImageIcon,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InspectionFinalizationDialog } from "./InspectionFinalizationDialog";
import { useInspectionFinalization } from "../hooks/use-inspection-finalization";
import type { InspectionDetail } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const priorityLabel = { high: "Alta", medium: "Media", low: "Baja" } as const;
const statusLabel = {
  pending: "Pendiente",
  in_review: "En revisión",
  resolved: "Atendido",
} as const;

export function InspectionDetailWorkspace({
  inspection: initialInspection,
}: {
  inspection: InspectionDetail;
}) {
  const { inspection, state, openConfirmation, closeConfirmation, finalize } =
    useInspectionFinalization(initialInspection);
  const [findings, setFindings] = useState([...inspection.findings]);
  const [deleteId, setDeleteId] = useState<string>();
  const editable =
    state === "draft" || state === "confirming" || state === "error";
  const completed = state === "finalized" || state === "offline-pending";
  const pendingSync =
    state === "offline-pending" || inspection.syncStatus === "pending";
  return (
    <section
      className={s.page}
      aria-labelledby="inspection-title"
    >
      <Link
        href="/inspections"
        className={s.backLink}
      >
        <ArrowLeft className={s.icon} />
        Volver a inspecciones
      </Link>
      <Card className={s.summaryCard}>
        <div className={s.summaryHeader}>
          <div>
            <p className={s.folio}>
              Folio #{inspection.folio}
            </p>
            <h1
              id="inspection-title"
              className={s.title}
            >
              {inspection.location}
            </h1>
            <p className={s.metadata}>
              <time dateTime={inspection.date}>
                {dateFormatter.format(new Date(`${inspection.date}T12:00:00`))}
              </time>{" "}
              · {inspection.technician}
            </p>
          </div>
          <div className={s.statuses}>
            <span className={s.resultStatus}>
              {findings.length ? "Requiere atención" : "Sin incidencias"}
            </span>
            <span className={s.workflowStatus}>
              {completed ? "Finalizada" : "Borrador"}
            </span>
            {pendingSync ? (
              <span className={s.syncStatus}>
                <CloudOff className={s.syncIcon} />
                Pendiente de sincronización
              </span>
            ) : null}
          </div>
        </div>
        <div className={s.scope}>
          <h2 className={s.scopeTitle}>Resumen</h2>
          <p className={s.scopeText}>
            {inspection.scope}
          </p>
        </div>
        {editable ? (
          <Button asChild variant="outline" className={s.editInspectionButton}>
            <Link href={`/inspections/${inspection.id}/edit`}>
              <Edit3 className={s.buttonIcon} />
              Editar inspección
            </Link>
          </Button>
        ) : null}
      </Card>
      <section className={s.findingsSection} aria-labelledby="findings-title">
        <div className={s.findingsHeader}>
          <h2 id="findings-title" className={s.findingsTitle}>
            Hallazgos
          </h2>
          <span className={s.findingsCount}>
            {findings.length} registrado{findings.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className={s.findingsList}>
          {findings.length === 0 ? (
            <Card className={s.emptyFindings}>
              No hay hallazgos registrados.
            </Card>
          ) : (
            findings.map((finding) => (
              <Card key={finding.id} className={s.findingCard}>
                <div className={s.findingLayout}>
                  <AlertTriangle className={s.findingIcon} />
                  <div className={s.findingContent}>
                    <div className={s.findingBadges}>
                      <span className={s.findingBadge}>
                        Prioridad {priorityLabel[finding.priority]}
                      </span>
                      <span className={s.findingBadge}>
                        {statusLabel[finding.status]}
                      </span>
                    </div>
                    <h3 className={s.findingTitle}>{finding.title}</h3>
                    <p className={s.findingDescription}>
                      {finding.description}
                    </p>
                    {finding.evidenceImage ? (
                      <div className={s.evidence}>
                        <img
                          src={finding.evidenceImage}
                          alt={finding.evidenceLabel}
                          className={s.evidenceImage}
                        />
                        <p className={s.evidenceLabel}>
                          <ImageIcon className={s.evidenceIcon} />
                          Evidencia fotográfica
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {editable ? (
                    <div className={s.findingActions}>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className={s.findingAction}
                      >
                        <Link
                          href={`/inspections/${inspection.id}/edit`}
                          aria-label={`Editar ${finding.title}`}
                        >
                          <Edit3 className={s.icon} />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={s.deleteFindingButton}
                        aria-label={`Eliminar ${finding.title}`}
                        onClick={() => setDeleteId(finding.id)}
                      >
                        <Trash2 className={s.icon} />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>
      </section>
      {editable ? (
        <Card className={s.actionBar}>
          <p className={s.draftStatus}>
            <span className={s.draftStatusDot} />
            Borrador editable
          </p>
          <Button onClick={openConfirmation}>Finalizar inspección</Button>
        </Card>
      ) : (
        <p className={s.completedNotice}>
          <CheckCircle2 className={s.icon} />
          Inspección finalizada en modo solo lectura.
        </p>
      )}
      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Eliminar hallazgo</AlertDialogTitle>
          <AlertDialogDescription>
            El hallazgo se eliminará de este borrador.
          </AlertDialogDescription>
          <div className={s.dialogActions}>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancelar</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                className={s.destructiveButton}
                onClick={() => {
                  setFindings((current) =>
                    current.filter((item) => item.id !== deleteId),
                  );
                  setDeleteId(undefined);
                }}
              >
                Eliminar
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <InspectionFinalizationDialog
        open={
          state === "confirming" || state === "submitting" || state === "error"
        }
        submitting={state === "submitting"}
        error={state === "error"}
        folio={inspection.folio}
        laboratory={inspection.location}
        findings={findings}
        syncStatus={inspection.syncStatus}
        onOpenChange={(open) => !open && closeConfirmation()}
        onConfirm={finalize}
      />
    </section>
  );
}

const s = {
  page: "mx-auto max-w-[1050px] pb-24",
  backLink: "inline-flex items-center gap-1 text-sm text-secondary-foreground hover:text-foreground",
  icon: "size-4",
  summaryCard: "mt-4 border-0 p-5 shadow-sm sm:p-7",
  summaryHeader: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
  folio: "font-mono text-[11px] text-muted-foreground",
  title: "mt-1 text-[30px] font-semibold tracking-tight",
  metadata: "mt-2 text-sm text-secondary-foreground",
  statuses: "flex flex-wrap gap-2",
  resultStatus: "rounded-sm bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900",
  workflowStatus: "rounded-sm bg-secondary px-2 py-1 text-xs",
  syncStatus: "flex items-center gap-1 rounded-sm bg-secondary px-2 py-1 text-xs",
  syncIcon: "size-3",
  scope: "mt-6 border-t pt-5",
  scopeTitle: "text-sm font-semibold",
  scopeText: "mt-2 leading-7 text-secondary-foreground",
  editInspectionButton: "mt-5",
  buttonIcon: "mr-1.5 size-4",
  findingsSection: "mt-7",
  findingsHeader: "flex items-center justify-between",
  findingsTitle: "text-xl font-semibold",
  findingsCount: "text-sm text-muted-foreground",
  findingsList: "mt-3 space-y-3",
  emptyFindings: "border-dashed p-8 text-center text-sm text-muted-foreground",
  findingCard: "p-5 shadow-sm",
  findingLayout: "flex gap-3",
  findingIcon: "mt-1 size-4 shrink-0 text-amber-700",
  findingContent: "min-w-0 flex-1",
  findingBadges: "flex flex-wrap gap-1.5 text-xs",
  findingBadge: "rounded-sm bg-secondary px-1.5 py-0.5",
  findingTitle: "mt-2 font-semibold",
  findingDescription: "mt-1 text-sm leading-6 text-secondary-foreground",
  evidence: "mt-4 flex items-center gap-3 border-t pt-4",
  evidenceImage: "size-14 rounded-sm object-cover",
  evidenceLabel: "flex items-center gap-1 text-xs text-muted-foreground",
  evidenceIcon: "size-3.5",
  findingActions: "flex",
  findingAction: "size-8",
  deleteFindingButton: "size-8 text-destructive hover:text-destructive",
  actionBar: "sticky bottom-3 z-10 mt-6 flex flex-col gap-3 border-0 bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between",
  draftStatus: "flex items-center gap-2 text-sm",
  draftStatusDot: "size-2 rounded-full bg-amber-700",
  completedNotice: "mt-6 flex items-center gap-2 rounded-sm bg-emerald-50 p-3 text-sm text-emerald-900",
  dialogActions: "flex justify-end gap-2",
  destructiveButton: "bg-destructive text-destructive-foreground",
};
