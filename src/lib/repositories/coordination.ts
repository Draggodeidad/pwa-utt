import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoordinationAcknowledgement, CoordinationRequest } from "../../features/inspections/coordination.ts";

export class CoordinationError extends Error {
  readonly status: 401 | 403 | 404 | 409 | 422 | 503;
  readonly code: string;
  constructor(status: CoordinationError["status"], code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export async function coordinateInspection(client: SupabaseClient, id: string, operationId: string, request: CoordinationRequest): Promise<CoordinationAcknowledgement> {
  const { data, error } = await client.rpc("coordinate_inspection", {
    p_operation_id: operationId, p_inspection_id: id, p_base_version: request.baseVersion,
    p_action: request.action, p_notes: request.notes ?? "", p_confirmation: request.confirmation ?? "",
  });
  if (error) {
    switch (error.message) {
      case "UNAUTHENTICATED": throw new CoordinationError(401, error.message, "Sesión no disponible");
      case "FORBIDDEN": throw new CoordinationError(403, error.message, "Acceso no permitido");
      case "NOT_FOUND": throw new CoordinationError(404, error.message, "Inspección no disponible");
      case "VERSION_CONFLICT":
      case "VERSION_OR_STATE_CONFLICT":
      case "IDEMPOTENCY_KEY_REUSED": throw new CoordinationError(409, error.message, "La inspección cambió. Recarga el detalle antes de continuar.");
      case "INVALID_INPUT":
      case "INVALID_CONFIRMATION": throw new CoordinationError(422, error.message, "Revisa el motivo y el folio de confirmación.");
      default: throw new CoordinationError(503, "UNAVAILABLE", "Servicio no disponible");
    }
  }
  if (!data || data.id !== id || !Number.isSafeInteger(data.version) || data.version < 1) throw new CoordinationError(503, "UNAVAILABLE", "Respuesta no disponible");
  return data as CoordinationAcknowledgement;
}
