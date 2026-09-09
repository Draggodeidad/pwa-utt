import type { SyncStatus } from "../types";

export type FinalizeInspectionResult = { workflowStatus: "completed"; syncStatus: Extract<SyncStatus, "pending" | "synced"> };

/** Frontend adapter that can later be replaced with a remote/offline repository without changing UI consumers. */
export async function finalizeInspectionLocally(): Promise<FinalizeInspectionResult> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
  return { workflowStatus: "completed", syncStatus: navigator.onLine ? "synced" : "pending" };
}
