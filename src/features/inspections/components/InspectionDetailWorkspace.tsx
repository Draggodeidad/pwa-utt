"use client";

import Link from "next/link";
import { InspectionLocation } from "@/features/inspections/components/InspectionLocation";
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
import { formatDateOnly } from "@/lib/format-date";
import { InspectionFinalizationDialog } from "./InspectionFinalizationDialog";
import { useInspectionFinalization } from "../hooks/use-inspection-finalization";
import type { InspectionDetail } from "../types";
import type { Uuid } from "@/types/entity";
import { FindingPhotos } from "@/features/findings";
import { InspectionCoordinationPanel } from "./InspectionCoordinationPanel";
import { FindingDescription } from "./FindingDescription";

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
  owner,
  coordinator = false,
}: {
  inspection: InspectionDetail;
  owner: Uuid;
  coordinator?: boolean;
}) {
  const { inspection, findings, state, finalizationPending, openConfirmation, closeConfirmation, removeFinding, finalize } =
    useInspectionFinalization(initialInspection, owner, !coordinator);
  const [deleteId, setDeleteId] = useState<string>();
  const [deleteError, setDeleteError] = useState(false);
  const editable =
    !coordinator && !finalizationPending && (state === "draft" || state === "confirming" || state === "error");
  const completed = inspection.workflowStatus === "completed";
  const pendingFinalization = finalizationPending;
  const pendingSync = inspection.syncStatus === "pending" || inspection.syncStatus === "local" || inspection.syncStatus === "error";
  return (
    <section
      className={s.page}
      aria-labelledby="inspection-title"
    >
      <Link
        href={inspection.coordination?.archivedAt ? "/inspections/archive" : "/inspections"}
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
                {formatDateOnly(inspection.date, dateFormatter)}
              </time>{" "}
              · {inspection.technician}
            </p>
          </div>
          <div className={s.statuses}>
            <span className={s.resultStatus}>
              {findings.length ? "Requiere atención" : "Sin incidencias"}
            </span>
            <span className={s.workflowStatus}>
              {pendingFinalization ? "Finalización pendiente" : completed ? "Finalizada" : "Borrador"}
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
      {coordinator ? <InspectionCoordinationPanel inspection={inspection} owner={owner} /> : null}
      <InspectionLocation inspection={inspection} />
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
          {deleteError ? (
            <p role="alert" className={s.deleteError}>
              No se pudo eliminar el hallazgo. Intenta de nuevo.
            </p>
          ) : null}
          {findings.length === 0 ? (
            <Card className={s.emptyFindings}>
              No hay hallazgos registrados.
            </Card>
          ) : (
            findings.map((finding) => (
              <Card key={finding.id} className={s.findingCard}>
                <div className={s.findingLayout}>
                  <div className={s.findingTopline}>
                    <div className={s.findingBadges}>
                      <AlertTriangle className={s.findingIcon} aria-hidden="true" />
                      <span className={s.findingBadge}>
                        Prioridad {priorityLabel[finding.priority]}
                      </span>
                      <span className={s.findingBadge}>
                        {statusLabel[finding.status]}
                      </span>
                    </div>
                    {editable ? (
                      <div className={s.findingActions}>
                        <Button asChild variant="ghost" size="icon" className={s.findingAction}>
                          <Link href={`/inspections/${inspection.id}/edit`} aria-label={`Editar ${finding.title}`}>
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
                  <h3 className={s.findingTitle}>{finding.title}</h3>
                  <FindingDescription description={finding.description} />
                  <FindingPhotos remoteOnly={coordinator} owner={owner} inspectionId={inspection.id} findingId={finding.id} />
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
          <Button className={s.finalizeButton} onClick={openConfirmation}>Finalizar inspección</Button>
        </Card>
      ) : (
        <p className={s.completedNotice}>
          <CheckCircle2 className={s.icon} />
          {pendingFinalization ? "Finalización pendiente de sincronizar." : "Inspección finalizada en modo solo lectura."}
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
                  setDeleteError(false);
                  void removeFinding(deleteId as string).catch(() => setDeleteError(true));
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
        owner={owner}
        inspectionId={inspection.id}
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
  page: "mx-auto max-w-[1050px] pb-32",
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
  findingsHeader: "flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between",
  findingsTitle: "text-xl font-semibold",
  findingsCount: "text-sm text-muted-foreground",
  findingsList: "mt-3 space-y-3",
  deleteError:
    "rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
  emptyFindings: "border-dashed p-8 text-center text-sm text-muted-foreground",
  findingCard: "p-3 shadow-sm sm:p-5",
  findingLayout: "flex min-w-0 flex-col gap-3",
  findingTopline: "flex min-w-0 items-start justify-between gap-2",
  findingIcon: "size-4 shrink-0 text-amber-700",
  findingBadges: "flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs",
  findingBadge: "rounded-sm bg-secondary px-1.5 py-0.5",
  findingTitle: "break-words font-semibold",
  findingActions: "flex shrink-0 items-center gap-1",
  findingAction: "size-11 min-h-11 min-w-11",
  deleteFindingButton: "size-11 min-h-11 min-w-11 text-destructive hover:text-destructive",
  actionBar: "sticky bottom-0 z-20 mt-6 flex flex-col gap-3 border-t bg-card p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-between sm:p-4",
  finalizeButton: "min-h-11 w-full whitespace-nowrap sm:w-auto",
  draftStatus: "flex items-center gap-2 text-sm",
  draftStatusDot: "size-2 rounded-full bg-amber-700",
  completedNotice: "mt-6 flex items-center gap-2 rounded-sm bg-emerald-50 p-3 text-sm text-emerald-900",
  dialogActions: "flex justify-end gap-2",
  destructiveButton: "bg-destructive text-destructive-foreground",
};
