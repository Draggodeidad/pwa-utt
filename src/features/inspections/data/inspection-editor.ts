import type { InspectionEditorValues, LaboratoryProfile } from "../types";

export const laboratoryProfiles: readonly LaboratoryProfile[] = [
  { code: "LAB-COMP-01", label: "Laboratorio de Cómputo 01", building: "Edificio B", floor: "Planta Alta" },
  { code: "LAB-COMP-04", label: "Centro de Cómputo General", building: "Edificio B", floor: "Planta 2" }
];

export const createInspectionValues: InspectionEditorValues = { id: "draft-0881", folio: "REG-INS-2026-088", laboratoryCode: "LAB-COMP-01", date: "2026-08-27", technician: "Técnica A", summary: "", findings: [], syncStatus: "local" };

export const editInspectionValues: InspectionEditorValues = { id: "inspection-004", folio: "INS-104", laboratoryCode: "LAB-COMP-04", date: "2026-08-27", technician: "Técnico B", summary: "Inspección periódica de estaciones de trabajo, cableado de red, proyector audiovisual y software académico instalado.", syncStatus: "pending", findings: [{ id: "HAL-01", priority: "medium", status: "pending", title: "Puerto Ethernet dañado y cable RJ45 suelto en estación PC-14", description: "Cable de red sin pestillo de sujeción en conector terminal y puerto switch de pared con intermitencia en banco 02.", evidenceCount: 1 }] };
