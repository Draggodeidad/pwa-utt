import type { InspectionListItem } from "./types.ts";

/** Date descending, null dates last, UUID descending for deterministic ties. */
export function sortOperationalInspections<T extends InspectionListItem>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.date !== right.date) {
      if (!left.date) return 1;
      if (!right.date) return -1;
      return left.date < right.date ? 1 : -1;
    }
    return left.id === right.id ? 0 : left.id < right.id ? 1 : -1;
  });
}

/** Totals cover unique visible inspections; historical results use completed only. */
export function summarizeOperationalInspections(items: readonly InspectionListItem[]) {
  const unique = Array.from(new Map(items.map((item) => [item.id, item])).values());
  const completed = unique.filter((item) => item.workflowStatus === "completed");
  return {
    visibleCount: unique.length,
    completedCount: completed.length,
    attentionCount: completed.filter((item) => item.result === "requires_attention").length,
    findingCount: completed.reduce((sum, item) => sum + item.findingCount, 0),
    pendingFindingCount: completed.reduce((sum, item) => sum + item.pendingFindingCount, 0),
    syncPendingCount: unique.filter((item) => item.syncStatus !== "synced").length,
  };
}
