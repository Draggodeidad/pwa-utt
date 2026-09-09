import type { TechnicianHomeData } from "../types";

/** Synthetic operational context for the technician home; replaceable by a feature repository later. */
export const technicianHomeData: TechnicianHomeData = {
  technicianId: "TEC-882",
  activeNotebook: "Periodo 2026-II",
  route: {
    completedRooms: 4,
    totalRooms: 6,
    description: "66% completado hoy"
  },
  upcomingStop: {
    laboratoryCode: "LAB-COMP-05",
    location: "Laboratorio de Cómputo Aplicado",
    description: "Revisión programada de estaciones, periféricos, red local y condiciones del espacio.",
    schedule: "Horario: 15:30 – 17:00",
    building: "Edificio C · Nivel 2"
  }
};
