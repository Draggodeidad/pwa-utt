import type { InspectionListItem } from "@/features/inspections";
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

/** Coordination read model derived from the inspection fixtures until repositories are connected. */
export function createCoordinationDashboard(
  inspections: readonly InspectionListItem[],
): CoordinationDashboard {
  const attentionInspections = inspections
    .filter((inspection) => inspection.result === "requires_attention")
    .map(toDashboardInspection);

  return {
    summary: {
      inspectionCount: inspections.length,
      inspectionCountRequiringAttention: attentionInspections.length,
      findingCount: inspections.reduce((total, inspection) => total + inspection.findingCount, 0),
      pendingFindingCount: attentionInspections.reduce((total, inspection) => total + inspection.findingCount, 0),
    },
    attentionInspections,
    recentInspections: inspections.slice(0, 3).map(toDashboardInspection),
  };
}
