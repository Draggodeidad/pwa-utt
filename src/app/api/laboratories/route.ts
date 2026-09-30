import type { NextRequest } from "next/server";
import { apiError, privateJson } from "@/lib/auth/http";
import { authorizeRequest } from "@/lib/auth/guards";
import { InspectionReadError, listActiveLaboratories } from "@/lib/repositories/inspections";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["technician", "coordinator"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  try {
    return auth.withCookies(privateJson(await listActiveLaboratories(auth.client)));
  } catch (error) {
    if (!(error instanceof InspectionReadError)) throw error;
    return auth.withCookies(apiError("UNAVAILABLE"));
  }
}