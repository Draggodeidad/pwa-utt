import { type NextRequest } from "next/server";
import { hasValidMutationOrigin, noStoreNoContent, privateJson } from "@/lib/auth/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasValidMutationOrigin(request)) return privateJson({ error: "Origen no permitido" }, 403);
  const auth = createRequestSupabaseClient(request);
  const { error } = await auth.client.auth.signOut({ scope: "local" });
  if (error && error.name !== "AuthSessionMissingError") {
    return auth.withCookies(privateJson({ error: "No fue posible cerrar sesión" }, 503));
  }
  return auth.withCookies(noStoreNoContent());
}
