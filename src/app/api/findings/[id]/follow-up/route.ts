import type { NextRequest } from "next/server";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { runFindingMutation } from "@/lib/api/finding-http";

export const dynamic = "force-dynamic";

/** Coordination-only follow-up: priority and status over a completed inspection. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = createRequestSupabaseClient(request);
  return (await runFindingMutation(request, auth, params.id, "finding.followup")).response;
}