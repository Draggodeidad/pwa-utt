import type { NextRequest } from "next/server";
import { apiError, privateJson } from "@/lib/auth/http";
import { authorizeRequest } from "@/lib/auth/guards";
import { FindingReadError, findVisibleFinding } from "@/lib/repositories/findings";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["technician", "coordinator"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  try {
    const detail = await findVisibleFinding(auth.client, params.id);
    return auth.withCookies(detail ? privateJson(detail) : apiError("NOT_FOUND"));
  } catch (error) {
    if (!(error instanceof FindingReadError)) throw error;
    return auth.withCookies(apiError("UNAVAILABLE"));
  }
}