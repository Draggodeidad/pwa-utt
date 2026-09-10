"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Plus,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InspectionFinalizationDialog } from "./InspectionFinalizationDialog";
import { laboratoryProfiles } from "../data/inspection-editor";
import { useInspectionEditor } from "../hooks/use-inspection-editor";
import type { InspectionEditorValues, InspectionFinding } from "../types";

type Props = { mode: "create" | "edit"; initialValues: InspectionEditorValues };
const maxSummary = 500;

function FindingDialog({
  finding,
  open,
  onOpenChange,
  onSave,
}: {
  finding?: InspectionFinding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (finding: InspectionFinding) => void;
}) {
  const [title, setTitle] = useState(finding?.title ?? "");
  const [description, setDescription] = useState(finding?.description ?? "");
  const [priority, setPriority] = useState<InspectionFinding["priority"]>(
    finding?.priority ?? "medium",
  );
  const submit = () => {
    if (!title.trim() || !description.trim()) return;
    onSave({
      ...finding,
      id: finding?.id ?? `HAL-${String(Date.now()).slice(-4)}`,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: finding?.status ?? "pending",
      evidenceCount: finding?.evidenceCount ?? 0,
    });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={s.findingDialog}>
        <DialogTitle>
          {finding ? "Editar hallazgo" : "Agregar hallazgo"}
        </DialogTitle>
        <DialogDescription>
          Describe el problema encontrado durante la inspección.
        </DialogDescription>
        <label className={s.field}>
          Título
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </label>
        <label className={s.field}>
          Descripción
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className={s.field}>
          Prioridad
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as InspectionFinding["priority"])
            }
            className={s.select}
          >
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
        </label>
        <div className={s.dialogActions}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Guardar hallazgo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InspectionEditorWorkspace({ mode, initialValues }: Props) {
  const editor = useInspectionEditor(initialValues);
  const {
    values,
    state,
    errors,
    toast,
    mutate,
    validate,
    save,
    addFinding,
    updateFinding,
    removeFinding,
    finalizeInspection,
    reset,
  } = editor;
  const [findingDialog, setFindingDialog] = useState<{
    open: boolean;
    finding?: InspectionFinding;
  }>({ open: false });
  const [deleteId, setDeleteId] = useState<string>();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const firstInvalid = useRef<HTMLSelectElement>(null);
  const laboratory =
    laboratoryProfiles.find((item) => item.code === values.laboratoryCode) ??
    laboratoryProfiles[0];
  const needsAttention = values.findings.length > 0;
  const editable = state !== "finalized" && state !== "finalizing";
  const saveLabel =
    state === "saving"
      ? "Guardando..."
      : state === "offline-saved"
        ? "Guardado localmente, pendiente de sincronización"
        : state === "saved"
          ? "Guardado localmente"
          : state === "dirty"
            ? "Cambios sin guardar"
            : "Borrador local";
  const requestFinalization = () => {
    if (!validate()) {
      firstInvalid.current?.focus();
      return;
    }
    setConfirming(true);
  };
  const finalize = async () => {
    await finalizeInspection();
    setConfirming(false);
  };
  const discard = () => {
    reset();
    setDiscardOpen(false);
  };

  return (
    <section className={s.page} aria-labelledby="editor-title">
      {toast ? (
        <div role="status" className={s.toast}>
          Borrador guardado localmente.
        </div>
      ) : null}
      <header className={s.header}>
        <div>
          <h1 id="editor-title" className={s.title}>
            {mode === "create" ? "Nueva inspección" : "Editar inspección"}
          </h1>
          <p className={s.saveStatus}>{saveLabel}</p>
        </div>
        <div className={s.resultStatus}>
          <span
            className={`${s.resultDot} ${needsAttention ? s.resultDotAttention : s.resultDotClear}`}
          />
          <span>
            {needsAttention ? "Requiere atención" : "Sin incidencias"}
          </span>
        </div>
      </header>
      <div className={s.workspace}>
        <form
          className={s.form}
          onSubmit={(event) => {
            event.preventDefault();
            requestFinalization();
          }}
        >
          <Card className={s.formCard}>
            <h2 className={s.sectionTitle}>Datos de la inspección</h2>
            <div className={s.fields}>
              <label className={s.field}>
                Laboratorio <span className={s.required}>Obligatorio</span>
                <select
                  ref={firstInvalid}
                  value={values.laboratoryCode}
                  onChange={(event) =>
                    mutate({ laboratoryCode: event.target.value })
                  }
                  aria-invalid={Boolean(errors.laboratoryCode)}
                  disabled={!editable}
                  className={s.select}
                >
                  {laboratoryProfiles.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {errors.laboratoryCode ? (
                  <span role="alert" className={s.fieldError}>
                    {errors.laboratoryCode}
                  </span>
                ) : null}
              </label>
              <div className={s.fieldColumns}>
                <label className={s.field}>
                  Fecha
                  <Input
                    type="date"
                    value={values.date}
                    onChange={(event) => mutate({ date: event.target.value })}
                    aria-invalid={Boolean(errors.date)}
                    disabled={!editable}
                  />
                  {errors.date ? (
                    <span role="alert" className={s.fieldError}>
                      {errors.date}
                    </span>
                  ) : null}
                </label>
                <div className={s.field}>
                  Técnico
                  <div className={s.technicianField}>
                    <UserRound className={s.icon} />
                    {values.technician}
                  </div>
                </div>
              </div>
              <label className={s.field}>
                Resumen
                <Textarea
                  value={values.summary}
                  maxLength={maxSummary}
                  onChange={(event) => mutate({ summary: event.target.value })}
                  aria-invalid={Boolean(errors.summary)}
                  disabled={!editable}
                />
                {errors.summary ? (
                  <span role="alert" className={s.fieldError}>
                    {errors.summary}
                  </span>
                ) : null}
                <span className={s.characterCount}>
                  {values.summary.length} / {maxSummary}
                </span>
              </label>
            </div>
          </Card>
          <Card className={s.formCard}>
            <div className={s.findingsHeader}>
              <div>
                <h2 className={s.sectionTitle}>Hallazgos</h2>
                <p className={s.findingsCount}>
                  {values.findings.length} registrado
                  {values.findings.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!editable}
                onClick={() => setFindingDialog({ open: true })}
              >
                <Plus className={s.buttonIcon} />
                Agregar hallazgo
              </Button>
            </div>
            <div className={s.findingsList}>
              {values.findings.length === 0 ? (
                <div className={s.emptyFindings}>
                  No hay hallazgos registrados.
                </div>
              ) : (
                values.findings.map((finding) => (
                  <article key={finding.id} className={s.finding}>
                    <AlertTriangle className={s.findingIcon} />
                    <div className={s.findingContent}>
                      <div className={s.findingBadges}>
                        <span className={s.findingBadge}>
                          Prioridad{" "}
                          {finding.priority === "high"
                            ? "alta"
                            : finding.priority === "medium"
                              ? "media"
                              : "baja"}
                        </span>
                        <span className={s.findingBadge}>Pendiente</span>
                      </div>
                      <h3 className={s.findingTitle}>{finding.title}</h3>
                      <p className={s.findingDescription}>
                        {finding.description}
                      </p>
                      {finding.evidenceCount ? (
                        <p className={s.evidenceCount}>
                          {finding.evidenceCount} evidencia adjunta
                        </p>
                      ) : null}
                    </div>
                    {editable ? (
                      <div className={s.findingActions}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={s.findingAction}
                          aria-label={`Editar ${finding.title}`}
                          onClick={() =>
                            setFindingDialog({ open: true, finding })
                          }
                        >
                          <Edit3 className={s.icon} />
                        </Button>
                        <Button
                          type="button"
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
                  </article>
                ))
              )}
            </div>
          </Card>
        </form>
        <aside>
          <Card className={s.laboratoryCard}>
            <h2 className={s.laboratoryTitle}>Laboratorio seleccionado</h2>
            <p className={s.laboratoryName}>{laboratory.label}</p>
            <p className={s.laboratoryLocation}>
              {laboratory.building}, {laboratory.floor}
            </p>
            <p className={s.laboratoryHint}>
              El resultado se calcula a partir de los hallazgos registrados.
            </p>
          </Card>
        </aside>
      </div>
      <Card className={s.actionBar}>
        <p className={s.actionBarStatus}>
          {needsAttention ? (
            <AlertTriangle className={s.attentionIcon} />
          ) : (
            <CheckCircle2 className={s.clearIcon} />
          )}
          <strong>
            {needsAttention ? "Requiere atención" : "Sin incidencias"}
          </strong>{" "}
          · {values.findings.length} hallazgo
          {values.findings.length === 1 ? "" : "s"}
        </p>
        <div className={s.actions}>
          <Button
            type="button"
            variant="ghost"
            className={s.discardButton}
            disabled={!editable}
            onClick={() => setDiscardOpen(true)}
          >
            Descartar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!editable || state === "saving"}
            onClick={() => void save()}
          >
            <Save className={s.buttonIcon} />
            Guardar borrador
          </Button>
          <Button
            type="button"
            disabled={!editable || state === "saving"}
            onClick={requestFinalization}
          >
            Finalizar inspección
          </Button>
        </div>
      </Card>
      <FindingDialog
        key={findingDialog.finding?.id ?? "new"}
        finding={findingDialog.finding}
        open={findingDialog.open}
        onOpenChange={(open) =>
          setFindingDialog((current) => ({ ...current, open }))
        }
        onSave={(finding) =>
          findingDialog.finding ? updateFinding(finding) : addFinding(finding)
        }
      />
      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Eliminar hallazgo</AlertDialogTitle>
          <AlertDialogDescription>
            El hallazgo se eliminará del borrador.
          </AlertDialogDescription>
          <div className={s.dialogActions}>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancelar</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                className={s.destructiveButton}
                onClick={() => {
                  if (deleteId) removeFinding(deleteId);
                  setDeleteId(undefined);
                }}
              >
                Eliminar
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Descartar cambios</AlertDialogTitle>
          <AlertDialogDescription>
            Se restaurarán los valores con los que abriste este formulario.
          </AlertDialogDescription>
          <div className={s.dialogActions}>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancelar</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button className={s.destructiveButton} onClick={discard}>
                Descartar
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <InspectionFinalizationDialog
        open={confirming}
        folio={values.folio}
        laboratory={laboratory.label}
        findings={values.findings}
        syncStatus={values.syncStatus}
        onOpenChange={setConfirming}
        onConfirm={() => void finalize()}
        submitting={state === "finalizing"}
      />
    </section>
  );
}

const s = {
  findingDialog: "max-h-[calc(100dvh-2rem)] overflow-y-auto",
  field: "grid gap-1 text-sm font-medium",
  select:
    "h-10 rounded-sm border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  dialogActions: "flex justify-end gap-2",
  page: "mx-auto max-w-[1050px] pb-28",
  toast:
    "fixed right-4 top-20 z-40 rounded-sm bg-secondary px-4 py-2 text-sm shadow-lg",
  header:
    "flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between",
  title: "text-[32px] font-semibold tracking-tight",
  saveStatus: "mt-1 text-sm text-muted-foreground",
  resultStatus:
    "flex items-center gap-2 rounded-sm bg-secondary px-3 py-2 text-sm",
  resultDot: "size-2 rounded-full",
  resultDotAttention: "bg-amber-700",
  resultDotClear: "bg-emerald-700",
  workspace: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]",
  form: "space-y-5",
  formCard: "p-5 shadow-sm",
  sectionTitle: "text-lg font-semibold",
  fields: "mt-4 grid gap-4",
  required: "text-destructive",
  fieldError: "text-xs text-destructive",
  fieldColumns: "grid gap-4 sm:grid-cols-2",
  technicianField:
    "flex h-10 items-center gap-2 rounded-sm bg-secondary px-3 font-normal",
  icon: "size-4",
  characterCount: "text-right text-xs text-muted-foreground",
  findingsHeader: "flex flex-wrap items-center justify-between gap-3",
  findingsCount: "text-sm text-muted-foreground",
  buttonIcon: "mr-1.5 size-4",
  findingsList: "mt-4 space-y-3",
  emptyFindings:
    "rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground",
  finding: "flex gap-3 rounded-sm border p-4",
  findingIcon: "mt-1 size-4 shrink-0 text-amber-700",
  findingContent: "min-w-0 flex-1",
  findingBadges: "flex flex-wrap gap-1.5 text-xs",
  findingBadge: "rounded-sm bg-secondary px-1.5 py-0.5",
  findingTitle: "mt-2 font-semibold",
  findingDescription: "mt-1 text-sm leading-6 text-secondary-foreground",
  evidenceCount: "mt-2 text-xs text-muted-foreground",
  findingActions: "flex",
  findingAction: "size-8",
  deleteFindingButton: "size-8 text-destructive hover:text-destructive",
  laboratoryCard: "p-4 shadow-sm",
  laboratoryTitle: "font-semibold",
  laboratoryName: "mt-2 text-sm",
  laboratoryLocation: "mt-1 text-sm text-muted-foreground",
  laboratoryHint: "mt-4 border-t pt-3 text-xs text-muted-foreground",
  actionBar:
    "sticky bottom-3 z-10 mt-6 flex flex-col gap-3 border-0 bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between",
  actionBarStatus: "flex items-center gap-2 text-sm",
  attentionIcon: "size-4 text-amber-700",
  clearIcon: "size-4 text-emerald-700",
  actions: "flex flex-wrap gap-2",
  discardButton: "text-destructive hover:text-destructive",
  destructiveButton: "bg-destructive text-destructive-foreground",
};
