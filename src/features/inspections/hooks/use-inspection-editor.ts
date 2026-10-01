"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { isPwaUpdatePreparing, registerPwaUpdateFlusher, trackPwaMutation } from "@/lib/pwa/update-coordination";
import {
  discardDraft,
  finalizeDraft,
  loadLocalDraft,
  saveDraft,
  toEditorValues,
  toLocalFinding,
  toLocalInspection,
  type RemovedFindingRef,
} from "../services/local-capture";
import type { InspectionEditorValues, InspectionFinding, LaboratoryOption } from "../types";
import type { Uuid } from "@/types/entity";

export type InspectionEditorState = "pristine" | "dirty" | "saving" | "saved" | "validation-error" | "save-error" | "finalizing" | "finalized";

type EditorOptions = { mode: "create" | "edit"; catalog: readonly LaboratoryOption[]; owner: Uuid; technician: string };

function readErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "payload" in error) {
    const payload = (error as { payload: { message?: string } }).payload;
    if (payload?.message) return payload.message;
  }
  return "No se pudo completar la operación. Intenta de nuevo.";
}

export function useInspectionEditor(initial: InspectionEditorValues, options: EditorOptions) {
  const { mode, catalog, owner, technician } = options;
  const [storage, setStorage] = useState<LocalStorage | null>(null);
  const [values, setValues] = useState<InspectionEditorValues>(initial);
  const [state, setState] = useState<InspectionEditorState>("pristine");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState(false);
  const [inspectionId] = useState(initial.id || crypto.randomUUID());
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const revisionRef = useRef(0);
  const removedRef = useRef<readonly RemovedFindingRef[]>([]);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    let active = true;
    LocalStorage.open().then((store) => {
      if (active) setStorage(store);
    }).catch(() => {
      if (active) setErrors({ form: "Almacenamiento local no disponible" });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storage || catalog.length === 0) return;
    void storage.saveCatalog(owner, catalog).catch(() => {
      setErrors((current) => ({ ...current, form: "No se pudo preparar el catálogo para uso sin conexión." }));
    });
  }, [storage, catalog, owner]);

  useEffect(() => {
    if (mode !== "edit" || !storage) return;
    let active = true;
    loadLocalDraft(owner, storage, initial.id).then((draft) => {
      if (active && draft) setValues(toEditorValues(draft.inspection, draft.findings, catalog, technician));
    }).catch(() => { /* keep the server-provided initial values */ });
    return () => { active = false; };
  }, [storage, mode, owner, initial.id, catalog, technician]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const mutate = (next: Partial<InspectionEditorValues>) => {
    if (isPwaUpdatePreparing()) return;
    revisionRef.current++;
    dirtyRef.current = true;
    setValues((current) => ({ ...current, ...next }));
    setState("dirty");
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!values.laboratoryCode) next.laboratoryCode = "Selecciona un laboratorio.";
    if (!values.date) next.date = "Indica una fecha de ejecución.";
    if (!values.summary.trim()) next.summary = "Agrega un resumen técnico.";
    setErrors(next);
    if (Object.keys(next).length) { setState("validation-error"); return false; }
    return true;
  };

  const save = useCallback(async () => {
    if (savePromiseRef.current) return savePromiseRef.current;
    if (!storage) { setErrors({ form: "Almacenamiento local no disponible" }); setState("save-error"); return false; }
    const task = trackPwaMutation(async () => {
      savingRef.current = true;
      setState("saving");
      try {
        do {
          const revision = revisionRef.current;
          const current = valuesRef.current;
          const removed = removedRef.current;
          const existing = await storage.getInspection(owner, inspectionId);
          const inspection = toLocalInspection(inspectionId, current, owner, catalog, existing);
          const findings = await Promise.all(current.findings.map(async (finding) => toLocalFinding(
            finding.id, inspectionId, finding, owner, finding.version ?? null, await storage.getFinding(owner, finding.id)
          )));
          await saveDraft(owner, storage, { owner, inspection, findings, removedFindings: removed });
          removedRef.current = removedRef.current.slice(removed.length);
          if (revision === revisionRef.current) break;
        } while (true);
        dirtyRef.current = false;
        setValues((currentValues) => ({ ...currentValues, syncStatus: "local" }));
        setState("saved");
        setToast(true);
        return true;
      } catch (error) {
        setErrors({ form: readErrorMessage(error) });
        setState("save-error");
        return false;
      } finally {
        savingRef.current = false;
      }
    });
    savePromiseRef.current = task;
    try { return await task; } finally { savePromiseRef.current = null; }
  }, [storage, owner, inspectionId, catalog]);

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => registerPwaUpdateFlusher(async () => {
    if (!dirtyRef.current && !savingRef.current) return;
    if (!await saveRef.current()) throw new Error("No se pudo guardar el borrador en este dispositivo.");
  }), []);

  useEffect(() => {
    if (!storage || state !== "dirty" || savingRef.current) return;
    const timer = window.setTimeout(() => { void saveRef.current(); }, 700);
    return () => window.clearTimeout(timer);
  }, [values, storage, state]);

  const addFinding = (finding: InspectionFinding) => {
    if (isPwaUpdatePreparing()) return;
    revisionRef.current++;
    dirtyRef.current = true;
    setValues((current) => ({ ...current, findings: [...current.findings, finding] }));
    setState("dirty");
  };
  const updateFinding = (finding: InspectionFinding) => {
    if (isPwaUpdatePreparing()) return;
    revisionRef.current++;
    dirtyRef.current = true;
    setValues((current) => ({ ...current, findings: current.findings.map((item) => (item.id === finding.id ? finding : item)) }));
    setState("dirty");
  };
  const removeFinding = (id: string) => {
    if (isPwaUpdatePreparing()) return;
    revisionRef.current++;
    dirtyRef.current = true;
    const removed = valuesRef.current.findings.find((finding) => finding.id === id);
    removedRef.current = [...removedRef.current, { id, baseVersion: removed?.version ?? null }];
    setValues((current) => ({ ...current, findings: current.findings.filter((finding) => finding.id !== id) }));
    setState("dirty");
  };

  const finalizeInspection = useCallback(async () => {
    if (isPwaUpdatePreparing()) return false;
    if (!storage) { setErrors({ form: "Almacenamiento local no disponible" }); setState("save-error"); return false; }
    setState("finalizing");
    try {
      const current = valuesRef.current;
      const existing = await storage.getInspection(owner, inspectionId);
      const inspection = toLocalInspection(inspectionId, current, owner, catalog, existing);
      const findings = await Promise.all(current.findings.map(async (finding) => toLocalFinding(
        finding.id, inspectionId, finding, owner, finding.version ?? null, await storage.getFinding(owner, finding.id)
      )));
      await trackPwaMutation(() => finalizeDraft(owner, storage, {
        owner,
        inspection,
        findings,
        removedFindings: removedRef.current,
        expectedFindingIds: current.findings.map((finding) => finding.id),
      }));
      removedRef.current = [];
      setValues((currentValues) => ({ ...currentValues, syncStatus: "pending" }));
      setState("finalized");
      return true;
    } catch (error) {
      setErrors({ form: readErrorMessage(error) });
      setState("save-error");
      return false;
    }
  }, [storage, owner, inspectionId, catalog]);

  const discard = useCallback(async () => {
    if (isPwaUpdatePreparing()) return false;
    if (!storage) { setErrors({ form: "Almacenamiento local no disponible" }); setState("save-error"); return false; }
    try {
      await trackPwaMutation(() => discardDraft(owner, storage, inspectionId));
      removedRef.current = [];
      dirtyRef.current = false;
      setErrors({});
      setState("pristine");
      return true;
    } catch {
      setErrors({ form: "No fue posible descartar el borrador. Intenta de nuevo." });
      setState("save-error");
      return false;
    }
  }, [storage, owner, inspectionId]);

  const reset = () => {
    dirtyRef.current = false;
    removedRef.current = [];
    setErrors({});
    setValues(initial);
    setState("pristine");
  };

  return { inspectionId, values, state, errors, toast, mutate, validate, save, addFinding, updateFinding, removeFinding, finalizeInspection, discard, reset };
}
