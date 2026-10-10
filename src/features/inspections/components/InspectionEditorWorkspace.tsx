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
import { useRouter } from "next/navigation";
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
import { FindingDescription } from "./FindingDescription";
import { OptionalLocation } from "./OptionalLocation";
import { useInspectionEditor } from "../hooks/use-inspection-editor";
import type { InspectionEditorValues, InspectionFinding, LaboratoryOption } from "../types";
import type { Uuid } from "@/types/entity";
import { FindingPhotos, type PhotoEdits } from "@/features/findings";

type Props = { mode: "create" | "edit"; initialValues: InspectionEditorValues; catalog: readonly LaboratoryOption[]; owner: Uuid };
const maxSummary = 500;

function FindingDialog({
  finding,
  owner,
  inspectionId,
  open,
  onOpenChange,
  onSave,
}: {
  finding?: InspectionFinding;
  owner: string;
  inspectionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (finding: InspectionFinding, photos: PhotoEdits) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(finding?.title ?? "");
  const [description, setDescription] = useState(finding?.description ?? "");
  const [priority, setPriority] = useState<InspectionFinding["priority"]>(
    finding?.priority ?? "medium",
  );
  const [findingId] = useState(() => finding?.id ?? crypto.randomUUID());
  const [photoEdits, setPhotoEdits] = useState<PhotoEdits>({ add: [], remove: [] });
  const [saving, setSaving] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const submit = async () => {
    if (!title.trim() || !description.trim()) return;
    if (saving || photosBusy) return;
    setSaving(true);
    const saved = await onSave({
      ...finding,
      id: findingId,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: finding?.status ?? "pending",

    }, photoEdits);
    setSaving(false); setSaveError(!saved);
    if (saved) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
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
        <FindingPhotos owner={owner} inspectionId={inspectionId} findingId={findingId} editable onChange={setPhotoEdits} onBusyChange={setPhotosBusy} />
        {saveError ? <p role="alert" className={s.field}>No se pudo guardar. Intenta de nuevo; tus fotos siguen en el diálogo.</p> : null}
        <div className={s.dialogActions}>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving || photosBusy} onClick={() => void submit()}>Guardar hallazgo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InspectionEditorWorkspace({ mode, initialValues, catalog, owner }: Props) {
  const router = useRouter();
  const editor = useInspectionEditor(initialValues, { mode, catalog, owner, technician: initialValues.technician });
  const {
    inspectionId,
    setCapturedLocation,
    values,
    state,
    errors,
    toast,
    mutate,
    validate,
    save,
    saveFindingWithPhotos,
    removeFinding,
    finalizeInspection,
    discard,
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
    catalog.find((item) => item.code === values.laboratoryCode) ?? null;
  const needsAttention = values.findings.length > 0;
  const editable = state !== "finalized" && state !== "finalizing";
  const saveLabel =
    state === "saving"
      ? "Guardando..."
      : state === "saved"
        ? "Guardado en este dispositivo"
        : state === "save-error"
          ? "No se pudo guardar"
          : state === "dirty"
            ? "Cambios sin guardar"
            : "Borrador";
  const requestFinalization = () => {
    if (!validate()) {
      firstInvalid.current?.focus();
      return;
    }
    setConfirming(true);
  };
  const finalize = async () => {
    const ok = await finalizeInspection();
    setConfirming(false);
    if (ok) router.push(`/inspections/${inspectionId}`);
  };
  const discardDraft = async () => {
    setDiscardOpen(false);
    if (await discard()) router.push("/inspections");
  };

  return (
    <section className={s.page} aria-labelledby="editor-title">
      {toast ? (
        <div role="status" className={s.toast}>
          Borrador guardado en este dispositivo.
        </div>
      ) : null}
      {state === "save-error" && errors.form ? (
        <div role="alert" className={s.formError}>
          {errors.form}
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
                  {catalog.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                  {catalog.length === 0 ? (
                    <option value="">Sin laboratorios disponibles</option>
                  ) : null}
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
              <OptionalLocation key={`${owner}:${inspectionId}`} owner={owner} onChange={setCapturedLocation} disabled={!editable} />
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
                className={s.addFindingButton}
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
                    <div className={s.findingTopline}>
                      <div className={s.findingBadges}>
                        <AlertTriangle className={s.findingIcon} aria-hidden="true" />
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
                      {editable ? (
                        <div className={s.findingActions}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={s.findingAction}
                            aria-label={`Editar ${finding.title}`}
                            onClick={() => setFindingDialog({ open: true, finding })}
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
                    </div>
                    <h3 className={s.findingTitle}>{finding.title}</h3>
                    <FindingDescription description={finding.description} />
                    <FindingPhotos owner={owner} inspectionId={inspectionId} findingId={finding.id} />
                  </article>
                ))
              )}
            </div>
          </Card>
        </form>
        <aside>
          <Card className={s.laboratoryCard}>
            <h2 className={s.laboratoryTitle}>Laboratorio seleccionado</h2>
            <p className={s.laboratoryName}>{laboratory ? laboratory.name : "Sin seleccionar"}</p>
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
            className={s.finalizeButton}
            disabled={!editable || state === "saving"}
            onClick={requestFinalization}
          >
            Finalizar inspección
          </Button>
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
            className={s.saveButton}
            disabled={!editable || state === "saving"}
            onClick={() => void save()}
          >
            <Save className={s.buttonIcon} />
            Guardar borrador
          </Button>
        </div>
      </Card>
      {findingDialog.open ? <FindingDialog
        key={findingDialog.finding?.id ?? "new"}
        finding={findingDialog.finding}
        owner={owner}
        inspectionId={inspectionId}
        open={findingDialog.open}
        onOpenChange={(open) =>
          setFindingDialog((current) => ({ ...current, open }))
        }
        onSave={saveFindingWithPhotos}
      /> : null}
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
          <AlertDialogTitle>Descartar borrador</AlertDialogTitle>
          <AlertDialogDescription>
            El borrador se eliminará de forma definitiva. Esta acción no se puede deshacer.
          </AlertDialogDescription>
          <div className={s.dialogActions}>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancelar</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button className={s.destructiveButton} onClick={() => void discardDraft()}>
                Descartar
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <InspectionFinalizationDialog
        owner={owner}
        inspectionId={inspectionId}
        open={confirming}
        folio={values.folio}
        laboratory={laboratory?.name ?? "Sin seleccionar"}
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
  formError:
    "rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
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
  findingsHeader: "flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between",
  addFindingButton: "min-h-11 w-full whitespace-nowrap sm:w-auto",
  findingsCount: "text-sm text-muted-foreground",
  buttonIcon: "mr-1.5 size-4",
  findingsList: "mt-4 space-y-3",
  emptyFindings:
    "rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground",
  finding: "flex min-w-0 flex-col gap-3 rounded-sm border p-3 sm:p-4",
  findingTopline: "flex min-w-0 items-start justify-between gap-2",
  findingIcon: "size-4 shrink-0 text-amber-700",
  findingBadges: "flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs",
  findingBadge: "rounded-sm bg-secondary px-1.5 py-0.5",
  findingTitle: "break-words font-semibold",
  findingActions: "flex shrink-0 items-center gap-1",
  findingAction: "size-11 min-h-11 min-w-11",
  deleteFindingButton: "size-11 min-h-11 min-w-11 text-destructive hover:text-destructive",
  laboratoryCard: "p-4 shadow-sm",
  laboratoryTitle: "font-semibold",
  laboratoryName: "mt-2 text-sm",
  laboratoryHint: "mt-4 border-t pt-3 text-xs text-muted-foreground",
  actionBar:
    "sticky bottom-0 z-20 mt-6 flex flex-col gap-3 border-t bg-card p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-between sm:p-4",
  actionBarStatus: "flex items-center gap-2 text-sm leading-5",
  attentionIcon: "size-4 text-amber-700",
  clearIcon: "size-4 text-emerald-700",
  actions: "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end",
  finalizeButton: "order-1 col-span-2 min-h-11 w-full whitespace-nowrap px-2 text-xs sm:order-3 sm:col-span-1 sm:w-auto sm:px-4 sm:text-sm",
  saveButton: "order-2 min-h-11 w-full whitespace-nowrap px-2 text-xs sm:order-2 sm:w-auto sm:px-4 sm:text-sm",
  discardButton: "order-3 min-h-11 w-full whitespace-nowrap px-2 text-xs text-destructive hover:text-destructive sm:order-1 sm:w-auto sm:px-4 sm:text-sm",
  destructiveButton: "bg-destructive text-destructive-foreground",
};
