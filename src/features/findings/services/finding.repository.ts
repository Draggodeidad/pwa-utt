import type { Finding } from "../types";

export interface FindingRepository {
  listByInspection(inspectionId: string): Promise<Finding[]>;
  getById(id: string): Promise<Finding | null>;
  save(finding: Finding): Promise<void>;
}
