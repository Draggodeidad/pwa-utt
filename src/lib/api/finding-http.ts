import type { NextRequest } from "next/server";
import type { ApiErrorCode } from "@/lib/auth/http";
import { apiError, privateJson, readJsonMutation, toFieldErrors } from "@/lib/auth/http";
import { authorizeRequest } from "@/lib/auth/guards";
import type { RequestSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/features/auth";
import type { DomainOperationKind } from "@/features/sync/types";
import { validateDomainOperation, validateOperationId } from "@/features/sync";
import { DomainValidationError } from "@/types/entity";
import { ApplyOperationError, applyFindingOperation } from "@/lib/repositories/operations";

const domainMessages: Record<string, string> = {
  UNAUTHENTICATED: "Sesión no disponible",
  FORBIDDEN: "Acceso no permitido",
  NOT_FOUND: "Recurso no disponible",
  VERSION_CONFLICT: "Versión desactualizada o estado no compatible",
  IDEMPOTENCY_KEY_REUSED: "La clave de idempotencia ya fue usada con otro contenido",
  ENTITY_ID_REUSED: "El identificador del hallazgo ya fue usado",
  UNAVAILABLE: "Servicio no disponible",
};

function httpCodeToApiError(status: number): ApiErrorCode {
  switch (status) {
    case 401: return "UNAUTHENTICATED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 422: return "INVALID_REQUEST";
    default: return "UNAVAILABLE";
  }
}

/**
 * Shared mutation entry for finding routes. Capture routes authorize the
 * technician; follow-up authorizes coordination. It parses the DEC-09 JSON body
 * with CSRF/origin checks, validates the Idempotency-Key, and maps
 * `apply_operation` failures to HTTP without exposing SQL or stack traces.
 */
export async function runFindingMutation(
  request: NextRequest,
  auth: RequestSupabaseClient,
  paramsId: string,
  expectedKind: DomainOperationKind
) {
  const roles: readonly UserRole[] = expectedKind === "finding.followup" ? ["coordinator"] : ["technician"];
  const permission = await authorizeRequest(auth.client, roles);
  if ("error" in permission) {
    return { response: auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN")) };
  }

  const parsed = await readJsonMutation(request);
  if (parsed.error) return { response: auth.withCookies(parsed.error) };

  try {
    const operationId = validateOperationId(request.headers.get("idempotency-key"));
    const operation = validateDomainOperation(parsed.body);
    if (operation.kind !== expectedKind) {
      throw new DomainValidationError([{ path: "kind", message: `must be ${expectedKind} for this endpoint` }]);
    }
    if (operation.entityId !== paramsId) {
      throw new DomainValidationError([{ path: "entityId", message: "must match the resource id" }]);
    }
    const acknowledgement = await applyFindingOperation(auth.client, operationId, operation);
    return { response: auth.withCookies(privateJson(acknowledgement, acknowledgement.replayed ? 200 : 201)) };
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return {
        response: auth.withCookies(apiError("INVALID_REQUEST", { code: "VALIDATION_ERROR", message: error.message, fieldErrors: toFieldErrors(error) })),
      };
    }
    if (error instanceof ApplyOperationError) {
      const message = domainMessages[error.code] ?? error.message;
      return { response: auth.withCookies(apiError(httpCodeToApiError(error.httpStatus), { code: error.code, message })) };
    }
    throw error;
  }
}
