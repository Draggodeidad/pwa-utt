"use client";

import { useCallback, useEffect, useState } from "react";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import {
  enqueueFinalizeIntent,
  hasPendingFinalization,
  loadLocalDraft,
  saveFindings,
  toLocalFinding,
  type RemovedFindingRef,
} from "../services/local-capture";
import type { InspectionDetail, InspectionFinding } from "../types";
import type { Uuid } from "@/types/entity";

export type InspectionFinalizationState = "draft" | "confirming" | "submitting" | "finalized" | "error";

function readErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "payload" in error) {
    const payload = (error as { payload: { message?: string } }).payload;
    if (payload?.message) return payload.message;
  }
  return "No se pudo completar la operación. Intenta de nuevo.";
}

export function useInspectionFinalization(initialInspection: InspectionDetail, owner: Uuid) {
  const [storage, setStorage] = useState<LocalStorage | null>(null);
  const [inspection, setInspection] = useState(initialInspection);
  const [findings, setFindings] = useState<readonly InspectionFinding[]>(() => [...initialInspection.findings]);
  const [removed, setRemoved] = useState<readonly RemovedFindingRef[]>([]);
  const [state, setState] = useState<InspectionFinalizationState>(initialInspection.workflowStatus === "completed" ? "finalized" : "draft");
  const [error, setError] = useState<string | null>(null);
  const [finalizationPending, setFinalizationPending] = useState(false);

  useEffect(() => {
    let active = true;
    LocalStorage.open().then((store) => {
      if (active) setStorage(store);
    }).catch(() => { /* local finalization unavailable */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storage) return;
    let active = true;
    (async () => {
      const draft = await loadLocalDraft(owner, storage, initialInspection.id);
      if (!active || !draft) return;
      setInspection((current) => ({ ...current, syncStatus: draft.inspection.syncStatus, workflowStatus: draft.inspection.workflowStatus }));
      setFindings(draft.findings.map((finding) => ({
        id: finding.id, priority: finding.priority, status: finding.status,
        title: finding.title, description: finding.description, version: finding.baseVersion,
      })));
      setFinalizationPending(await hasPendingFinalization(owner, storage, initialInspection.id));
    })();
    return () => { active = false; };
  }, [storage, owner, initialInspection.id]);

  const openConfirmation = useCallback(() => setState("confirming"), []);
  const closeConfirmation = useCallback(() => {
    setState(finalizationPending || inspection.workflowStatus === "completed" ? "finalized" : "draft");
    setError(null);
  }, [finalizationPending, inspection.workflowStatus]);

  const removeFinding = useCallback(async (id: string) => {
    const finding = findings.find((item) => item.id === id);
    if (!finding) return;
    const remaining = findings.filter((item) => item.id !== id);
    if (storage) {
      const findingsLocal = remaining.map((item) => toLocalFinding(item.id, inspection.id, item, owner, item.version ?? null, null));
      await saveFindings(owner, storage, {
        owner,
        findings: findingsLocal,
        removedFindings: [{ id, baseVersion: finding.version ?? null }],
      });
    }
    setFindings(remaining);
    setRemoved((current) => [...current, { id, baseVersion: finding.version ?? null }]);
    setError(null);
  }, [findings, inspection.id, owner, storage]);

  const finalize = useCallback(async () => {
    setState("submitting");
    try {
      if (!storage) throw new Error("storage unavailable");
      if (removed.length) {
        const findingsLocal = findings.map((item) => toLocalFinding(item.id, inspection.id, item, owner, item.version ?? null, null));
        await saveFindings(owner, storage, {
          owner,
          findings: findingsLocal,
          removedFindings: removed,
        });
      }
      const existing = await storage.getInspection(owner, inspection.id);
      await enqueueFinalizeIntent(owner, storage, {
        inspectionId: inspection.id,
        baseVersion: existing?.baseVersion ?? inspection.version,
        expectedFindingIds: findings.map((item) => item.id),
      });
      setInspection((current) => ({ ...current, syncStatus: "pending" }));
      setFinalizationPending(true);
      setState("finalized");
      setError(null);
    } catch (failure) {
      setError(readErrorMessage(failure));
      setState("error");
    }
  }, [findings, removed, inspection.id, inspection.version, owner, storage]);

  return { inspection, findings, state, error, finalizationPending, openConfirmation, closeConfirmation, removeFinding, finalize };
}