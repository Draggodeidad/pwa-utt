import type { InspectionEditorValues, LaboratoryProfile } from "../types";

export const laboratoryProfiles: readonly LaboratoryProfile[] = [
  { code: "LAB-COMP-01", label: "Laboratorio de Cómputo 01", building: "Edificio B", floor: "Planta Alta", image: "/inspection-assets/laboratory-evidence-2.jpeg", activeStations: "33 / 35 activas", network: "Enlace gigabit OK (1 Gbps)", audiovisual: "Proyector HDMI operativo", climate: "Aire acondicionado en 22°C", protocol: "EST-NORM-04" },
  { code: "LAB-COMP-04", label: "Centro de Cómputo General", building: "Edificio B", floor: "Planta 2", image: "/inspection-assets/laboratory-evidence-2.jpeg", activeStations: "30 / 32 activas", network: "Red disponible", audiovisual: "Proyector en revisión", climate: "Ventilación adecuada", protocol: "PROT-COMP-TS04-5001" }
];

export const createInspectionValues: InspectionEditorValues = { id: "draft-0881", folio: "REG-INS-2026-088", laboratoryCode: "LAB-COMP-01", date: "2026-08-27", technician: "Técnica A", technicianId: "TÉC-ID #4418", summary: "", findings: [], syncStatus: "local" };

export const editInspectionValues: InspectionEditorValues = { id: "inspection-004", folio: "INS-104", laboratoryCode: "LAB-COMP-04", date: "2026-08-27", technician: "Técnico B", technicianId: "TÉC-ID #4418", summary: "Inspección periódica de estaciones de trabajo, cableado de red, proyector audiovisual y software académico instalado.", syncStatus: "pending", findings: [{ id: "HAL-01", priority: "medium", status: "pending", title: "Puerto Ethernet dañado y cable RJ45 suelto en estación PC-14", description: "Cable de red sin pestillo de sujeción en conector terminal y puerto switch de pared con intermitencia en banco 02.", evidenceCount: 1, recordedAt: "10:42 hrs" }] };
