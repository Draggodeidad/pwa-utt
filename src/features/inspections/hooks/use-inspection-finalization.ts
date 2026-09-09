"use client";

import { useCallback, useState } from "react";
import { finalizeInspectionLocally } from "../services/local-inspection-finalization";
import type { InspectionDetail } from "../types";

export type InspectionFinalizationState = "draft" | "confirming" | "submitting" | "finalized" | "error" | "offline-pending";

export function useInspectionFinalization(initialInspection: InspectionDetail) {
  const [inspection, setInspection] = useState(initialInspection);
  const [state, setState] = useState<InspectionFinalizationState>("draft");

  const openConfirmation = useCallback(() => setState("confirming"), []);
  const closeConfirmation = useCallback(() => {
    if (state !== "submitting") setState(inspection.workflowStatus === "completed" ? (inspection.syncStatus === "pending" ? "offline-pending" : "finalized") : "draft");
  }, [inspection.syncStatus, inspection.workflowStatus, state]);
  const finalize = useCallback(async () => {
    setState("submitting");
    try {
      const result = await finalizeInspectionLocally();
      setInspection((current) => ({ ...current, ...result, updatedAt: new Date().toISOString() }));
      setState(result.syncStatus === "pending" ? "offline-pending" : "finalized");
    } catch {
      setState("error");
    }
  }, []);

  return { inspection, state, openConfirmation, closeConfirmation, finalize };
}
