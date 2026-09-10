"use client";

import { useEffect, useRef, useState } from "react";
import type { InspectionEditorValues, InspectionFinding } from "../types";

export type InspectionEditorState = "pristine" | "dirty" | "saving" | "saved" | "validation-error" | "save-error" | "offline-saved" | "finalizing" | "finalized";

export function useInspectionEditor(initial: InspectionEditorValues) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<InspectionEditorState>("pristine");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState(false);
  const dirtyRef = useRef(false);
  const mutate = (next: Partial<InspectionEditorValues>) => { dirtyRef.current = true; setValues((current) => ({ ...current, ...next })); setState("dirty"); };
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, []);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(false), 3000); return () => window.clearTimeout(timeout); }, [toast]);
  const validate = () => { const next: Record<string, string> = {}; if (!values.laboratoryCode) next.laboratoryCode = "Selecciona un laboratorio."; if (!values.date) next.date = "Indica una fecha de ejecución."; if (!values.summary.trim()) next.summary = "Agrega un resumen técnico."; setErrors(next); if (Object.keys(next).length) { setState("validation-error"); return false; } return true; };
  const save = async () => { setState("saving"); await new Promise<void>((resolve) => window.setTimeout(resolve, 350)); const offline = !navigator.onLine; dirtyRef.current = false; setValues((current) => ({ ...current, syncStatus: offline ? "pending" : "synced" })); setState(offline ? "offline-saved" : "saved"); setToast(true); return true; };
  const addFinding = (finding: InspectionFinding) => mutate({ findings: [...values.findings, finding] });
  const updateFinding = (finding: InspectionFinding) => mutate({ findings: values.findings.map((item) => item.id === finding.id ? finding : item) });
  const removeFinding = (id: string) => mutate({ findings: values.findings.filter((finding) => finding.id !== id) });
  const finalizeInspection = async () => { setState("finalizing"); await new Promise<void>((resolve) => window.setTimeout(resolve, 450)); const offline = !navigator.onLine; dirtyRef.current = false; setValues((current) => ({ ...current, syncStatus: offline ? "pending" : "synced" })); setState("finalized"); };
  const reset = () => { dirtyRef.current = false; setValues(initial); setErrors({}); setState("pristine"); };
  return { values, state, errors, toast, mutate, validate, save, addFinding, updateFinding, removeFinding, finalizeInspection, reset };
}
