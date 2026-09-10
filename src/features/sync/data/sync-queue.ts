import type { SyncQueueRecord } from "../types";

export const initialSyncQueue: readonly SyncQueueRecord[] = [
  {
    id: "inspection-104",
    folio: "INS-104",
    laboratory: "Laboratorio de Cómputo 01",
    date: "2026-08-27",
    status: "pending",
  },
  {
    id: "inspection-101",
    folio: "INS-101",
    laboratory: "Aula de Cómputo B",
    date: "2026-08-27",
    status: "error",
  },
  {
    id: "inspection-102",
    folio: "INS-102",
    laboratory: "Laboratorio de Redes y Telecomunicaciones",
    date: "2026-08-27",
    status: "pending",
  },
];

export const initialLastSyncAt = "2026-08-27T10:15:00";
