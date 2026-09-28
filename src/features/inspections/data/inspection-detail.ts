import type { InspectionDetail } from "../types";
import { inspections } from "./inspections";

/** Synthetic detail record used by the frontend until an inspection repository is connected. */
export const inspectionDetail: InspectionDetail = {
  id: "inspection-004",
  folio: "INS-104",
  location: "Centro de Cómputo General",
  date: "2026-08-25",
  technician: "Técnico B",
  workflowStatus: "draft",
  result: "requires_attention",
  syncStatus: "pending",
  scope: "Inspección periódica de 35 estaciones de trabajo, cableado de red Cat6, proyectores audiovisuales y software académico instalado.",
  findings: [
    { id: "H-01", priority: "high", status: "pending", title: "Cableado expuesto en estación PC-17", description: "El aislamiento técnico del conductor principal presenta fisura longitudinal de 35 mm con cobre a la vista cerca de la pinza de tierra. Se desenergizó el equipo y se solicitó reemplazo preventivo.", evidenceLabel: "Evidencia fotográfica de cableado", evidenceImage: "/inspection-assets/laboratory-evidence-1.jpeg" },
    { id: "H-02", priority: "medium", status: "in_review", title: "Monitor sin señal de video en estación PC-22", description: "La estación inicia con normalidad, pero el monitor permanece sin señal. Se requiere revisar conexión DisplayPort y el estado del adaptador de video.", evidenceLabel: "Registro visual del equipo" }
  ]
};

/** Read-only synthetic detail selector shared by the SSR route and future read views. */
export function findInspectionDetail(id: string): InspectionDetail | undefined {
  const listItem = inspections.find((item) => item.id === id);
  if (!listItem) return undefined;
  if (id === inspectionDetail.id) return inspectionDetail;

  return {
    id: listItem.id,
    folio: listItem.id,
    location: listItem.location,
    date: listItem.date,
    technician: listItem.inspector,
    workflowStatus: listItem.workflowStatus,
    result: listItem.result,
    syncStatus: listItem.syncStatus,
    scope: listItem.summary,
    findings: Array.from({ length: listItem.findingCount }, (_, index) => ({ id: `${listItem.id}-finding-${index + 1}`, title: `Hallazgo sintético ${index + 1}`, description: "Observación registrada durante la inspección del laboratorio para seguimiento.", priority: "medium" as const, status: "pending" as const })),
  };
}
