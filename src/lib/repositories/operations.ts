import type { SupabaseClient } from "@supabase/supabase-js";
import type { DomainErrorCode, DomainOperation, OperationAcknowledgement, SyncEntityKind } from "@/features/sync";
import type { Uuid } from "@/types/entity";

/** A domain error raised by `apply_operation`, already translated to HTTP. */
export class ApplyOperationError extends Error {
  readonly code: DomainErrorCode | "UNAVAILABLE";
  readonly httpStatus: number;

  constructor(code: DomainErrorCode | "UNAVAILABLE", message: string, httpStatus: number) {
    super(message);
    this.name = "ApplyOperationError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function mapRpcFailure(code: string | undefined, message: string): { domain: DomainErrorCode | "UNAVAILABLE"; http: number } {
  switch (message) {
    case "UNAUTHENTICATED": return { domain: "UNAUTHENTICATED", http: 401 };
    case "FORBIDDEN":
    case "FORBIDDEN_OR_INVALID_INPUT": return { domain: "FORBIDDEN", http: 403 };
    case "NOT_FOUND":
    case "NOT_EDITABLE": return { domain: "NOT_FOUND", http: 404 };
    case "VERSION_OR_STATE_CONFLICT":
    case "VERSION_CONFLICT": return { domain: "VERSION_CONFLICT", http: 409 };
    case "IDEMPOTENCY_KEY_REUSED": return { domain: "IDEMPOTENCY_KEY_REUSED", http: 409 };
    case "FINDING_SET_CONFLICT": return { domain: "FINDING_SET_CONFLICT", http: 409 };
    case "INVALID_INPUT":
    case "INVALID_OPERATION":
    case "INVALID_LABORATORY":
    case "INVALID_TRANSITION":
    case "FINALIZATION_INVALID": return { domain: "VALIDATION_ERROR", http: 422 };
    default: return { domain: "UNAVAILABLE", http: 503 };
  }
}

type OperationRow = { version: number; updated_at: string; folio_number?: number };

/**
 * Shared remote write path. `apply_operation` is the only write entry point and
 * runs with the caller's identity; every branch of the RPC validates actor,
 * role, ownership, state and version.
 */
async function applyOperation(
  client: SupabaseClient,
  operationId: Uuid,
  operation: DomainOperation,
  entityType: SyncEntityKind
): Promise<OperationAcknowledgement> {
  const { data, error } = await client.rpc("apply_operation", {
    p_operation_id: operationId,
    p_client_id: operation.clientId,
    p_kind: operation.kind,
    p_entity_id: operation.entityId,
    p_base_version: operation.baseVersion,
    p_payload: operation.payload,
  });

  if (error) {
    const mapped = mapRpcFailure(error.code, error.message ?? "");
    throw new ApplyOperationError(mapped.domain, error.message ?? mapped.domain, mapped.http);
  }
  if (!data || typeof data !== "object" || typeof (data as OperationRow).version !== "number") {
    throw new ApplyOperationError("UNAVAILABLE", "apply_operation did not return an entity", 503);
  }

  const row = data as OperationRow;
  return {
    operationId,
    entityId: operation.entityId,
    entityType,
    version: row.version,
    appliedAt: row.updated_at,
    replayed: false,
    ...(Number.isSafeInteger(row.folio_number) && (row.folio_number as number) > 0 ? { folioNumber: row.folio_number } : {}),
  };
}

export async function applyInspectionOperation(
  client: SupabaseClient,
  operationId: Uuid,
  operation: DomainOperation
): Promise<OperationAcknowledgement> {
  return applyOperation(client, operationId, operation, "inspection");
}

export async function applyFindingOperation(
  client: SupabaseClient,
  operationId: Uuid,
  operation: DomainOperation
): Promise<OperationAcknowledgement> {
  return applyOperation(client, operationId, operation, "finding");
}
