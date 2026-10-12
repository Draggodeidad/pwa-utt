import type { FindingPriority, FindingStatus } from "../../findings/types.ts";
import type { InspectionDraftInput } from "../schemas/inspection.schema.ts";
import type { InspectionRepository } from "./inspection.repository.ts";
import type { FindingRepository } from "../../findings/services/finding.repository.ts";

export type FinalizeFinding = {
  id: string;
  version: number | null;
  title: string;
  description: string;
  priority: FindingPriority;
  status: FindingStatus;
  removed?: boolean;
  pendingUpdate?: boolean;
};

import type { InspectionLocation } from "../types.ts";

export type FinalizeInspectionInput = {
  location?: InspectionLocation | null;
  inspectionId: string;
  inspectionVersion: number | null;
  inspectionDraft: InspectionDraftInput;
  inspectionDirty: boolean;
  findings: readonly FinalizeFinding[];
  inspectionRepository: Pick<InspectionRepository, "create" | "update" | "finalize">;
  findingRepository: Pick<FindingRepository, "create" | "update" | "delete">;
};

export type FinalizeInspectionResult = { workflowStatus: "completed"; syncStatus: "synced" };

/**
 * Single finalize use case shared by editor and detail. It persists the capture
 * and waits for every finding ACK, then sends the current version and the exact
 * expectedFindingIds to the server so the set is validated atomically.
 */
export async function finalizeInspection(input: FinalizeInspectionInput): Promise<FinalizeInspectionResult> {
  const { inspectionId, inspectionVersion, inspectionDraft, inspectionDirty, findings, inspectionRepository, findingRepository } = input;

  const location = input.location ? { ...input.location } : null;
  let version = inspectionVersion;
  if (version === null) {
    version = (await inspectionRepository.create(inspectionId, inspectionDraft)).version;
  } else if (inspectionDirty) {
    version = (await inspectionRepository.update(inspectionId, version, inspectionDraft)).version;
  }

  for (const finding of findings) {
    if (finding.removed) {
      if (finding.version !== null) await findingRepository.delete(finding.id, finding.version);
      continue;
    }
    if (finding.version === null) {
      await findingRepository.create(finding.id, {
        inspectionId,
        title: finding.title,
        description: finding.description,
        priority: finding.priority,
      });
    } else if (finding.pendingUpdate) {
      await findingRepository.update(finding.id, finding.version, {
        title: finding.title,
        description: finding.description,
        priority: finding.priority,
      });
    }
  }

  const expectedFindingIds = findings.filter((finding) => !finding.removed).map((finding) => finding.id);
  await inspectionRepository.finalize(inspectionId, version, expectedFindingIds, location);

  return { workflowStatus: "completed", syncStatus: "synced" };
}