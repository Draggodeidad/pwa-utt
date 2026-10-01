import type { InspectionListItem } from "../../inspections/types.ts";
import { sortOperationalInspections, summarizeOperationalInspections } from "../../inspections/operational-summaries.ts";
import type { CoordinationDashboard, DashboardInspection } from "../types";

function toDashboardInspection(inspection: InspectionListItem): DashboardInspection {
  return {
    id: inspection.id,
    location: inspection.location,
    date: inspection.date,
    inspector: inspection.inspector,
    findingCount: inspection.findingCount,
    result: inspection.result,
  };
}

/** Coordination read model derived from the complete authorized read result. */
export function createCoordinationDashboard(
  inspections: readonly InspectionListItem[],
): CoordinationDashboard {
  const completed = sortOperationalInspections(inspections.filter((inspection) => inspection.workflowStatus === "completed"));
  const totals = summarizeOperationalInspections(completed);
  const attentionInspections = completed
    .filter((inspection) => inspection.result === "requires_attention")
    .slice(0, 3).map(toDashboardInspection);

  return {
    summary: {
      inspectionCount: totals.completedCount,
      inspectionCountRequiringAttention: totals.attentionCount,
      findingCount: totals.findingCount,
      pendingFindingCount: totals.pendingFindingCount,
    },
    attentionInspections,
    recentInspections: completed.slice(0, 3).map(toDashboardInspection),
  };
}
