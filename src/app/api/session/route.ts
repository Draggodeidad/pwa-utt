import { type NextRequest } from "next/server";
import { apiError, privateJson } from "@/lib/auth/http";
import { readSession } from "@/lib/auth/session-store";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (request.cookies.get("pwa-utt-logout-blocked")?.value === "1") return apiError("UNAUTHENTICATED");
  const auth = createRequestSupabaseClient(request);
  const session = await readSession(auth.client);
  if (!session) return auth.withCookies(apiError("UNAUTHENTICATED"));
  return auth.withCookies(privateJson(session));
}
