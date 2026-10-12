import type { NextRequest } from "next/server";
import { authorizeRequest } from "@/lib/auth/guards";
import { apiError, privateJson } from "@/lib/auth/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { expectUuid } from "@/types/entity";
import { photoFromRow, type PhotoRow } from "@/lib/photos/remote";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["technician", "coordinator"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  try {
    const id = expectUuid(params.id, "findingId");
    const finding = await auth.client.from("findings").select("id").eq("id", id).maybeSingle();
    if (finding.error) return auth.withCookies(apiError("UNAVAILABLE"));
    if (!finding.data) return auth.withCookies(apiError("NOT_FOUND"));
    const result = await auth.client.from("finding_photos").select("*").eq("finding_id", id).neq("state", "deleted").order("created_at");
    if (result.error) return auth.withCookies(apiError("UNAVAILABLE"));
    return auth.withCookies(privateJson((result.data as PhotoRow[]).map(photoFromRow)));
  } catch { return auth.withCookies(apiError("INVALID_REQUEST")); }
}
