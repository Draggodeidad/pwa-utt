"use client";

import { useCallback, useMemo, useState } from "react";
import { HttpClient } from "@/lib/api/http-client";
import { RemoteInspectionRepository } from "../services/remote-inspection.repository";
import { RemoteFindingRepository } from "../../findings/services/remote-finding.repository";
import { finalizeInspection as runFinalize, type FinalizeFinding } from "../services/finalize-inspection";
import type { InspectionDetail, InspectionFinding } from "../types";

export type InspectionFinalizationState = "draft" | "confirming" | "submitting" | "finalized" | "error";

type RemovedFinding = { id: string; version: number | null };

function readErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "payload" in error) {
    const payload = (error as { payload: { message?: string } }).payload;
    if (payload?.message) return payload.message;
  }
  return "No se pudo completar la operación. Intenta de nuevo.";
}

export function useInspectionFinalization(initialInspection: InspectionDetail) {
  const repositories = useMemo(() => {
    const client = new HttpClient();
    return { inspections: new RemoteInspectionRepository(client), findings: new RemoteFindingRepository(client) };
  }, []);
  const [inspection, setInspection] = useState(initialInspection);
  const [findings, setFindings] = useState<readonly InspectionFinding[]>(() => [...initialInspection.findings]);
  const [removed, setRemoved] = useState<readonly RemovedFinding[]>([]);
  const [state, setState] = useState<InspectionFinalizationState>(initialInspection.workflowStatus === "completed" ? "finalized" : "draft");
  const [error, setError] = useState<string | null>(null);

  const openConfirmation = useCallback(() => setState("confirming"), []);
  const closeConfirmation = useCallback(() => {
    setState(inspection.workflowStatus === "completed" ? "finalized" : "draft");
    setError(null);
  }, [inspection.workflowStatus]);

  const removeFinding = useCallback(async (id: string) => {
    const finding = findings.find((item) => item.id === id);
    if (!finding) return;
    if (finding.version != null) {
      await repositories.findings.delete(id, finding.version);
    }
    setFindings((current) => current.filter((item) => item.id !== id));
    setRemoved((current) => [...current, { id, version: finding.version ?? null }]);
    setError(null);
  }, [findings, repositories]);

  const finalize = useCallback(async () => {
    setState("submitting");
    try {
      const detailFindings: FinalizeFinding[] = [
        ...findings.map((finding) => ({
          id: finding.id,
          version: finding.version ?? null,
          title: finding.title,
          description: finding.description,
          priority: finding.priority,
          status: finding.status,
        })),
        ...removed.map(({ id, version }) => ({
          id,
          version,
          title: "",
          description: "",
          priority: "medium" as const,
          status: "pending" as const,
          removed: true,
        })),
      ];
      const result = await runFinalize({
        inspectionId: inspection.id,
        inspectionVersion: inspection.version,
        inspectionDraft: { summary: inspection.scope },
        inspectionDirty: false,
        findings: detailFindings,
        inspectionRepository: repositories.inspections,
        findingRepository: repositories.findings,
      });
      setInspection((current) => ({ ...current, workflowStatus: "completed", syncStatus: result.syncStatus }));
      setState("finalized");
      setError(null);
    } catch (failure) {
      setError(readErrorMessage(failure));
      setState("error");
    }
  }, [findings, removed, inspection.id, inspection.version, inspection.scope, repositories]);

  return { inspection, findings, state, error, openConfirmation, closeConfirmation, removeFinding, finalize };
}