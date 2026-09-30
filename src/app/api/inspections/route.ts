import type { NextRequest } from "next/server";
import { apiError, privateJson, toFieldErrors } from "@/lib/auth/http";
import { authorizeRequest } from "@/lib/auth/guards";
import { DomainValidationError } from "@/types/entity";
import { InspectionReadError, listVisibleInspectionsPage, parseInspectionCursor } from "@/lib/repositories/inspections";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import type { InspectionWorkflowStatus } from "@/features/inspections";

export const dynamic = "force-dynamic";

const statuses: readonly InspectionWorkflowStatus[] = ["draft", "completed"];
const maxSearchLength = 100;

function readPositiveInt(value: string | null, path: string): number | null {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new DomainValidationError([{ path, message: "must be a positive integer" }]);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new DomainValidationError([{ path, message: "must be between 1 and 100" }]);
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["technician", "coordinator"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  try {
    const params = request.nextUrl.searchParams;
    const limit = readPositiveInt(params.get("limit"), "limit");
    const cursor = params.get("cursor");
    if (cursor) parseInspectionCursor(cursor);
    const search = params.get("search");
    if (search !== null && search.length > maxSearchLength) {
      throw new DomainValidationError([{ path: "search", message: "must be 100 characters or fewer" }]);
    }
    const statusParam = params.get("status");
    const status = statusParam === null ? undefined
      : (statuses as readonly string[]).includes(statusParam) ? statusParam as InspectionWorkflowStatus
      : throwInvalidStatus();
    const page = await listVisibleInspectionsPage(auth.client, { limit: limit ?? undefined, cursor: cursor ?? undefined, search: search ?? undefined, status });
    return auth.withCookies(privateJson(page));
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return auth.withCookies(apiError("INVALID_REQUEST", { code: "VALIDATION_ERROR", message: error.message, fieldErrors: toFieldErrors(error) }));
    }
    if (error instanceof InspectionReadError) return auth.withCookies(apiError("UNAVAILABLE"));
    throw error;
  }
}

function throwInvalidStatus(): never {
  throw new DomainValidationError([{ path: "status", message: "must be draft or completed" }]);
}