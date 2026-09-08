import type { InspectionListItem } from "../types";

/** Synthetic seed data retained for the starter screen, not a persistence implementation. */
export const inspections: InspectionListItem[] = [
  {
    id: "inspection-001",
    location: "Laboratorio de Redes",
    date: "2026-08-28",
    inspector: "Técnica A",
    result: "without_findings",
    findingCount: 0,
    syncStatus: "synced",
    summary: "Revisión visual de cableado, ventilación y estaciones de trabajo."
  },
  {
    id: "inspection-002",
    location: "Laboratorio de Electrónica",
    date: "2026-08-27",
    inspector: "Técnico B",
    result: "requires_attention",
    findingCount: 2,
    syncStatus: "synced",
    summary: "Se registraron dos observaciones sintéticas para seguimiento de mantenimiento."
  },
  {
    id: "inspection-003",
    location: "Laboratorio de Software",
    date: "2026-08-26",
    inspector: "Técnica C",
    result: "without_findings",
    findingCount: 0,
    syncStatus: "synced",
    summary: "Comprobación de equipo, señalización y disponibilidad del espacio."
  }
];
