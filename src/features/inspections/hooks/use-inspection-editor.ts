"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HttpClient } from "@/lib/api/http-client";
import { RemoteInspectionRepository } from "../services/remote-inspection.repository";
import { RemoteFindingRepository } from "../../findings/services/remote-finding.repository";
import { finalizeInspection as runFinalize, type FinalizeFinding } from "../services/finalize-inspection";
import type { InspectionEditorValues, InspectionFinding, LaboratoryOption } from "../types";
import type { InspectionDraftInput } from "../schemas/inspection.schema";

export type InspectionEditorState = "pristine" | "dirty" | "saving" | "saved" | "validation-error" | "save-error" | "finalizing" | "finalized";

type EditorOptions = { mode: "create" | "edit"; catalog: readonly LaboratoryOption[] };

function readErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "payload" in error) {
    const payload = (error as { payload: { message?: string } }).payload;
    if (payload?.message) return payload.message;
  }
  return "No se pudo completar la operación. Intenta de nuevo.";
}

function buildDraft(values: InspectionEditorValues, catalog: readonly LaboratoryOption[]): InspectionDraftInput {
  const draft: InspectionDraftInput = { summary: values.summary };
  const laboratory = catalog.find((item) => item.code === values.laboratoryCode);
  if (laboratory) draft.laboratoryId = laboratory.id;
  if (values.date) draft.inspectionDate = values.date;
  return draft;
}

export function useInspectionEditor(initial: InspectionEditorValues, options: EditorOptions) {
  const { mode, catalog } = options;
  const repositories = useMemo(() => {
    const client = new HttpClient();
    return { inspections: new RemoteInspectionRepository(client), findings: new RemoteFindingRepository(client) };
  }, []);
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<InspectionEditorState>("pristine");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState(false);
  const [inspectionId] = useState(initial.id || crypto.randomUUID());
  const [inspectionVersion, setInspectionVersion] = useState<number | null>(initial.version ?? null);
  const [created, setCreated] = useState(mode === "edit");
  const [findingVersions, setFindingVersions] = useState<Record<string, number>>(() => {
    const versions: Record<string, number> = {};
    for (const finding of initial.findings) if (finding.version != null) versions[finding.id] = finding.version;
    return versions;
  });
  const [pendingUpdates, setPendingUpdates] = useState<ReadonlySet<string>>(new Set());
  const [removedFindingIds, setRemovedFindingIds] = useState<readonly string[]>([]);
  const dirtyRef = useRef(false);
  const inspectionDirtyRef = useRef(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const mutate = (next: Partial<InspectionEditorValues>) => {
    dirtyRef.current = true;
    inspectionDirtyRef.current = true;
    setValues((current) => ({ ...current, ...next }));
    setState("dirty");
  };
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
  const validate = () => {
    const next: Record<string, string> = {};
    if (!values.laboratoryCode) next.laboratoryCode = "Selecciona un laboratorio.";
    if (!values.date) next.date = "Indica una fecha de ejecución.";
    if (!values.summary.trim()) next.summary = "Agrega un resumen técnico.";
    setErrors(next);
    if (Object.keys(next).length) { setState("validation-error"); return false; }
    return true;
  };

  /** Persists the draft and pending findings; resolves only after every remote ACK. */
  const flush = async (): Promise<number> => {
    const draft = buildDraft(valuesRef.current, catalog);
    let version: number;
    if (!created) {
      const ack = await repositories.inspections.create(inspectionId, draft);
      version = ack.version;
      setInspectionVersion(version);
      setCreated(true);
    } else {
      version = inspectionVersion as number;
      if (inspectionDirtyRef.current) {
        const ack = await repositories.inspections.update(inspectionId, version, draft);
        version = ack.version;
        setInspectionVersion(version);
      }
    }
    inspectionDirtyRef.current = false;
    for (const id of removedFindingIds) {
      const persistedVersion = findingVersions[id];
      if (persistedVersion != null) await repositories.findings.delete(id, persistedVersion);
    }
    setRemovedFindingIds([]);
    for (const finding of valuesRef.current.findings) {
      const persistedVersion = findingVersions[finding.id];
      if (persistedVersion == null) {
        const ack = await repositories.findings.create(finding.id, {
          inspectionId, title: finding.title, description: finding.description, priority: finding.priority,
        });
        setFindingVersions((current) => ({ ...current, [finding.id]: ack.version }));
      } else if (pendingUpdates.has(finding.id)) {
        const ack = await repositories.findings.update(finding.id, persistedVersion, {
          title: finding.title, description: finding.description, priority: finding.priority,
        });
        setFindingVersions((current) => ({ ...current, [finding.id]: ack.version }));
      }
    }
    setPendingUpdates(new Set());
    dirtyRef.current = false;
    return version;
  };

  const save = async () => {
    setState("saving");
    try {
      await flush();
      setValues((current) => ({ ...current, syncStatus: "synced" }));
      setState("saved");
      setToast(true);
      return true;
    } catch (error) {
      setErrors({ form: readErrorMessage(error) });
      setState("save-error");
      return false;
    }
  };

  const addFinding = (finding: InspectionFinding) => {
    dirtyRef.current = true;
    setValues((current) => ({ ...current, findings: [...current.findings, finding] }));
    setPendingUpdates((current) => new Set(current).add(finding.id));
    setState("dirty");
  };
  const updateFinding = (finding: InspectionFinding) => {
    dirtyRef.current = true;
    setValues((current) => ({ ...current, findings: current.findings.map((item) => (item.id === finding.id ? finding : item)) }));
    setPendingUpdates((current) => new Set(current).add(finding.id));
    setState("dirty");
  };
  const removeFinding = (id: string) => {
    dirtyRef.current = true;
    setValues((current) => ({ ...current, findings: current.findings.filter((finding) => finding.id !== id) }));
    if (findingVersions[id] != null) setRemovedFindingIds((current) => [...current, id]);
    setState("dirty");
  };

  const finalizeInspection = async () => {
    setState("finalizing");
    try {
      const findings: FinalizeFinding[] = [
        ...valuesRef.current.findings.map((finding) => ({
          id: finding.id,
          version: findingVersions[finding.id] ?? null,
          title: finding.title,
          description: finding.description,
          priority: finding.priority,
          status: finding.status,
          pendingUpdate: pendingUpdates.has(finding.id),
        })),
        ...removedFindingIds.map((id) => ({
          id,
          version: findingVersions[id] ?? null,
          title: "",
          description: "",
          priority: "medium" as const,
          status: "pending" as const,
          removed: true,
        })),
      ];
      const result = await runFinalize({
        inspectionId,
        inspectionVersion,
        inspectionDraft: buildDraft(valuesRef.current, catalog),
        inspectionDirty: !created || inspectionDirtyRef.current,
        findings,
        inspectionRepository: repositories.inspections,
        findingRepository: repositories.findings,
      });
      dirtyRef.current = false;
      inspectionDirtyRef.current = false;
      setPendingUpdates(new Set());
      setRemovedFindingIds([]);
      setValues((current) => ({ ...current, syncStatus: result.syncStatus }));
      setState("finalized");
      return true;
    } catch (error) {
      setErrors({ form: readErrorMessage(error) });
      setState("save-error");
      return false;
    }
  };

  const discard = async () => {
    if (created) {
      try {
        await repositories.inspections.discard(inspectionId, inspectionVersion as number);
      } catch {
        setErrors({ form: "No fue posible descartar el borrador. Intenta de nuevo." });
        setState("save-error");
        return false;
      }
    }
    dirtyRef.current = false;
    inspectionDirtyRef.current = false;
    setPendingUpdates(new Set());
    setRemovedFindingIds([]);
    setErrors({});
    setValues(initial);
    setState("pristine");
    return true;
  };

  const reset = () => {
    dirtyRef.current = false;
    inspectionDirtyRef.current = false;
    setPendingUpdates(new Set());
    setRemovedFindingIds([]);
    setErrors({});
    setValues(initial);
    setState("pristine");
  };

  return { inspectionId, values, state, errors, toast, mutate, validate, save, addFinding, updateFinding, removeFinding, finalizeInspection, discard, reset };
}