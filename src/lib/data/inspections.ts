export type InspectionStatus = "ok" | "attention";

export type Inspection = {
  id: string;
  location: string;
  date: string;
  inspector: string;
  status: InspectionStatus;
  statusLabel: string;
  findings: number;
  summary: string;
};

export const inspections: Inspection[] = [
  {
    id: "inspection-001",
    location: "Laboratorio de Redes",
    date: "2026-08-28",
    inspector: "Técnica A",
    status: "ok",
    statusLabel: "Sin incidencias",
    findings: 0,
    summary: "Revisión visual de cableado, ventilación y estaciones de trabajo."
  },
  {
    id: "inspection-002",
    location: "Laboratorio de Electrónica",
    date: "2026-08-27",
    inspector: "Técnico B",
    status: "attention",
    statusLabel: "Requiere atención",
    findings: 2,
    summary: "Se registraron dos observaciones sintéticas para seguimiento de mantenimiento."
  },
  {
    id: "inspection-003",
    location: "Laboratorio de Software",
    date: "2026-08-26",
    inspector: "Técnica C",
    status: "ok",
    statusLabel: "Sin incidencias",
    findings: 0,
    summary: "Comprobación de equipo, señalización y disponibilidad del espacio."
  }
];

export function getInspectionStatusLabel(inspection: Inspection): string {
  // CORRECCIÓN APLICADA: Uso de comparación estricta (===) para evitar mutación del objeto
  if (inspection.status === "attention") {
    return "Requiere atención";
  }
  return "Sin incidencias";
}

export function validateInspection(inspection: Inspection): { valid: boolean; error?: string } {
  if (inspection.status === "attention" && inspection.findings === 0) {
    return { valid: false, error: "Inspección marcada con atención no tiene hallazgos registrados" };
  }
  if (inspection.status === "ok" && inspection.findings > 0) {
    return { valid: false, error: "Inspección marcada como OK contiene hallazgos pendientes" };
  }
  return { valid: true };
}
