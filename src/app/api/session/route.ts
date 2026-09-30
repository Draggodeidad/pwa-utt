import { type NextRequest } from "next/server";
import { privateJson } from "@/lib/auth/http";
import { readSession } from "@/lib/auth/session-store";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = createRequestSupabaseClient(request);
  const session = await readSession(auth.client);
  if (!session) return auth.withCookies(privateJson({ error: "Sesión no disponible" }, 401));
  return auth.withCookies(privateJson(session));
}
