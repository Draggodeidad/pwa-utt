import type { InspectionDetail } from "../types";

/** Synthetic detail record used by the frontend until an inspection repository is connected. */
export const inspectionDetail: InspectionDetail = {
  id: "inspection-004",
  folio: "INS-104",
  location: "Laboratorio de Cómputo 04",
  date: "2026-08-27",
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
