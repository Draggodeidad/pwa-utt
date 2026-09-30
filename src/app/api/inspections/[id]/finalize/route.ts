import type { NextRequest } from "next/server";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { runInspectionMutation } from "@/lib/api/inspection-http";

export const dynamic = "force-dynamic";

/** Finalizes an inspection draft after the expected finding set is confirmed. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = createRequestSupabaseClient(request);
  return (await runInspectionMutation(request, auth, params.id, "inspection.finalize")).response;
}