import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/lib/auth/guards";
import { apiError, privateJson, readJsonMutation, toFieldErrors, type ApiErrorCode } from "@/lib/auth/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { isInspectionId } from "@/lib/repositories/inspections";
import { coordinateInspection, CoordinationError } from "@/lib/repositories/coordination";
import { validateCoordinationRequest } from "@/features/inspections/coordination";
import { DomainValidationError } from "@/types/entity";

export const dynamic = "force-dynamic";
const statusCode: Record<number, ApiErrorCode> = { 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 422: "INVALID_REQUEST", 503: "UNAVAILABLE" };

/** Online-only endpoint, deliberately separate from the IndexedDB operation queue. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["coordinator"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  if (!isInspectionId(params.id)) return auth.withCookies(apiError("NOT_FOUND"));
  const parsed = await readJsonMutation(request, 16384);
  if (parsed.error) return auth.withCookies(parsed.error);
  try {
    const operationId = request.headers.get("idempotency-key");
    if (!operationId || !isInspectionId(operationId)) throw new DomainValidationError([{ path: "idempotency-key", message: "Identificador de operación no válido" }]);
    const body = validateCoordinationRequest(parsed.body);
    return auth.withCookies(privateJson(await coordinateInspection(auth.client, params.id, operationId, body)));
  } catch (error) {
    if (error instanceof DomainValidationError) return auth.withCookies(apiError("INVALID_REQUEST", { code: "VALIDATION_ERROR", fieldErrors: toFieldErrors(error) }));
    if (error instanceof CoordinationError) return auth.withCookies(apiError(statusCode[error.status], { code: error.code, message: error.message }));
    throw error;
  }
}
