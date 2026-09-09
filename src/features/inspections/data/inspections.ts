import type { InspectionListItem } from "../types";

/** Synthetic seed data retained for the starter screen, not a persistence implementation. */
export const inspections: InspectionListItem[] = [
  {
    id: "inspection-001",
    location: "Laboratorio de Cómputo A",
    laboratoryCode: "LAB-COMP-01",
    date: "2026-08-28",
    inspector: "Técnica A",
    result: "without_findings",
    findingCount: 0,
    syncStatus: "synced",
    workflowStatus: "completed",
    summary: "Revisión visual de cableado, ventilación y estaciones de trabajo."
  },
  {
    id: "inspection-002",
    location: "Laboratorio de Cómputo B",
    laboratoryCode: "LAB-COMP-02",
    date: "2026-08-27",
    inspector: "Técnico B",
    result: "requires_attention",
    findingCount: 2,
    syncStatus: "synced",
    workflowStatus: "completed",
    summary: "Se registraron dos observaciones sintéticas para seguimiento de mantenimiento."
  },
  {
    id: "inspection-003",
    location: "Laboratorio de Cómputo C",
    laboratoryCode: "LAB-COMP-03",
    date: "2026-08-26",
    inspector: "Técnica C",
    result: "without_findings",
    findingCount: 0,
    syncStatus: "synced",
    workflowStatus: "completed",
    summary: "Comprobación de equipo, señalización y disponibilidad del espacio."
  },
  {
    id: "inspection-004",
    location: "Centro de Cómputo General",
    laboratoryCode: "LAB-COMP-04",
    date: "2026-08-25",
    inspector: "Técnico B",
    result: "requires_attention",
    findingCount: 3,
    syncStatus: "pending",
    workflowStatus: "draft",
    summary: "Registro sintético pendiente de sincronización para el mantenimiento de estaciones."
  }
];
