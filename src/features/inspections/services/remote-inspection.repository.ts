import type { ApiClient } from "../../../lib/api/client.ts";
import { getInstallationId } from "../../sync/installation.ts";
import type { OperationAcknowledgement } from "../../sync/types.ts";
import type { InspectionDetail, InspectionListItem } from "../types.ts";
import type { InspectionDraftInput } from "../schemas/inspection.schema.ts";
import type { InspectionRepository } from "./inspection.repository.ts";

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

/** HTTP-backed inspection repository for the online technician flow. */
export class RemoteInspectionRepository implements InspectionRepository {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async list(): Promise<InspectionListItem[]> {
    const { items } = await this.client.get<{ items: InspectionListItem[] }>("/api/inspections?limit=100");
    return items;
  }

  async getDetail(id: string): Promise<InspectionDetail | null> {
    try {
      return await this.client.get<InspectionDetail>(`/api/inspections/${id}`);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  create(id: string, draft: InspectionDraftInput): Promise<OperationAcknowledgement> {
    return this.client.put<OperationAcknowledgement, OperationBody>(
      `/api/inspections/${id}`,
      buildBody("inspection.create", id, null, draft),
      { operationId: crypto.randomUUID() }
    );
  }

  update(id: string, baseVersion: number, draft: InspectionDraftInput): Promise<OperationAcknowledgement> {
    return this.client.patch<OperationAcknowledgement, OperationBody>(
      `/api/inspections/${id}`,
      buildBody("inspection.update", id, baseVersion, draft),
      { operationId: crypto.randomUUID() }
    );
  }

  discard(id: string, baseVersion: number): Promise<OperationAcknowledgement> {
    return this.client.delete<OperationAcknowledgement>(
      `/api/inspections/${id}`,
      { operationId: crypto.randomUUID(), body: buildBody("inspection.discard", id, baseVersion, {}) }
    );
  }

  finalize(id: string, baseVersion: number, expectedFindingIds: readonly string[]): Promise<OperationAcknowledgement> {
    return this.client.post<OperationAcknowledgement, OperationBody>(
      `/api/inspections/${id}/finalize`,
      buildBody("inspection.finalize", id, baseVersion, { expectedFindingIds }),
      { operationId: crypto.randomUUID() }
    );
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status: number }).status === 404;
}