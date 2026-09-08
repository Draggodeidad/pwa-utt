import type { Inspection, InspectionListItem } from "../types";

/** Port implemented later by an API-backed or offline-first data source. */
export interface InspectionRepository {
  list(): Promise<InspectionListItem[]>;
  getById(id: string): Promise<Inspection | null>;
  save(inspection: Inspection): Promise<void>;
}
