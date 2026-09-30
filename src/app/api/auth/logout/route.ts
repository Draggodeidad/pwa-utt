import { type NextRequest } from "next/server";
import { apiError, hasValidMutationOrigin, noStoreNoContent } from "@/lib/auth/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasValidMutationOrigin(request)) return apiError("FORBIDDEN");
  const auth = createRequestSupabaseClient(request);
  const { error } = await auth.client.auth.signOut({ scope: "local" });
  if (error && error.name !== "AuthSessionMissingError") {
    return auth.withCookies(apiError("UNAVAILABLE"));
  }
  return auth.withCookies(noStoreNoContent());
}
