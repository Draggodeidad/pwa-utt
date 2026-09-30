import type { NextRequest } from "next/server";
import { apiError, privateJson, toFieldErrors } from "@/lib/auth/http";
import { authorizeRequest } from "@/lib/auth/guards";
import { DomainValidationError } from "@/types/entity";
import { FindingReadError, isFindingId, listVisibleFindingsPage, parseFindingCursor } from "@/lib/repositories/findings";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import type { FindingPriority, FindingStatus } from "@/features/findings";

export const dynamic = "force-dynamic";

const priorities: readonly FindingPriority[] = ["low", "medium", "high"];
const statuses: readonly FindingStatus[] = ["pending", "in_review", "resolved"];

function readPositiveInt(value: string | null, path: string): number | null {
  if (value === null) return null;
  if (!/^\d+$/.test(value)) throw new DomainValidationError([{ path, message: "must be a positive integer" }]);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new DomainValidationError([{ path, message: "must be between 1 and 100" }]);
  }
  return parsed;
}

function throwInvalid(path: string, message: string): never {
  throw new DomainValidationError([{ path, message }]);
}

export async function GET(request: NextRequest) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["technician", "coordinator"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  try {
    const params = request.nextUrl.searchParams;
    const limit = readPositiveInt(params.get("limit"), "limit");
    const cursor = params.get("cursor");
    if (cursor) parseFindingCursor(cursor);
    const inspectionParam = params.get("inspectionId");
    if (inspectionParam !== null && !isFindingId(inspectionParam)) {
      throw new DomainValidationError([{ path: "inspectionId", message: "must be a UUID" }]);
    }
    const priorityParam = params.get("priority");
    const priority = priorityParam === null ? undefined
      : (priorities as readonly string[]).includes(priorityParam) ? priorityParam as FindingPriority
      : throwInvalid("priority", "must be low, medium or high");
    const statusParam = params.get("status");
    const status = statusParam === null ? undefined
      : (statuses as readonly string[]).includes(statusParam) ? statusParam as FindingStatus
      : throwInvalid("status", "must be pending, in_review or resolved");
    const page = await listVisibleFindingsPage(auth.client, {
      limit: limit ?? undefined,
      cursor: cursor ?? undefined,
      inspectionId: inspectionParam ?? undefined,
      priority,
      status,
    });
    return auth.withCookies(privateJson(page));
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return auth.withCookies(apiError("INVALID_REQUEST", { code: "VALIDATION_ERROR", message: error.message, fieldErrors: toFieldErrors(error) }));
    }
    if (error instanceof FindingReadError) return auth.withCookies(apiError("UNAVAILABLE"));
    throw error;
  }
}