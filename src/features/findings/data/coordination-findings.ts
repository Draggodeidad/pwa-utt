import { inspectionDetail } from "@/features/inspections";
import type { CoordinationFinding } from "../types";

/**
 * Temporary cross-inspection read model. It derives from the inspection fixture
 * until the findings repository is connected to a frontend data source.
 */
export const coordinationFindings: readonly CoordinationFinding[] = inspectionDetail.findings.map((finding) => ({
  id: finding.id,
  inspectionId: inspectionDetail.id,
  folio: inspectionDetail.folio,
  title: finding.title,
  description: finding.description,
  laboratory: inspectionDetail.location,
  date: inspectionDetail.date,
  technician: inspectionDetail.technician,
  priority: finding.priority,
  status: finding.status,
  evidenceLabel: finding.evidenceLabel,
  evidenceImage: finding.evidenceImage,
  internalNote: "",
}));
