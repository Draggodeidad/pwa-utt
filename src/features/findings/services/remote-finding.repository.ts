import type { ApiClient } from "../../../lib/api/client.ts";
import { getInstallationId } from "../../sync/installation.ts";
import type { OperationAcknowledgement } from "../../sync/types.ts";
import type { FindingDto } from "../types.ts";
import type { FindingCaptureInput, FindingFollowupInput } from "../schemas/finding.schema.ts";
import type { FindingRepository } from "./finding.repository.ts";

type OperationBody = {
  clientId: string;
  kind: string;
  entityId: string;
  baseVersion?: number;
  payload: Record<string, unknown>;
};

function buildBody(kind: string, entityId: string, baseVersion: number | null, payload: Record<string, unknown>): OperationBody {
  return { clientId: getInstallationId(), kind, entityId, ...(baseVersion === null ? {} : { baseVersion }), payload };
}

/** HTTP-backed finding repository for online capture and coordination. */
export class RemoteFindingRepository implements FindingRepository {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async listByInspection(inspectionId: string): Promise<FindingDto[]> {
    const { items } = await this.client.get<{ items: FindingDto[] }>(`/api/findings?inspectionId=${encodeURIComponent(inspectionId)}&limit=100`);
    return items;
  }

  async getById(id: string): Promise<FindingDto | null> {
    try {
      return await this.client.get<FindingDto>(`/api/findings/${id}`);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  create(id: string, capture: FindingCaptureInput): Promise<OperationAcknowledgement> {
    return this.client.put<OperationAcknowledgement, OperationBody>(
      `/api/findings/${id}`,
      buildBody("finding.create", id, null, capture as Record<string, unknown>),
      { operationId: crypto.randomUUID() }
    );
  }

  update(id: string, baseVersion: number, capture: FindingCaptureInput): Promise<OperationAcknowledgement> {
    return this.client.patch<OperationAcknowledgement, OperationBody>(
      `/api/findings/${id}`,
      buildBody("finding.update", id, baseVersion, capture as Record<string, unknown>),
      { operationId: crypto.randomUUID() }
    );
  }

  delete(id: string, baseVersion: number): Promise<OperationAcknowledgement> {
    return this.client.delete<OperationAcknowledgement>(
      `/api/findings/${id}`,
      { operationId: crypto.randomUUID(), body: buildBody("finding.delete", id, baseVersion, {}) }
    );
  }

  followup(id: string, baseVersion: number, changes: FindingFollowupInput): Promise<OperationAcknowledgement> {
    return this.client.patch<OperationAcknowledgement, OperationBody>(
      `/api/findings/${id}/follow-up`,
      buildBody("finding.followup", id, baseVersion, changes as Record<string, unknown>),
      { operationId: crypto.randomUUID() }
    );
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status: number }).status === 404;
}