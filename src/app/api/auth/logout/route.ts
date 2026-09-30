import { type NextRequest } from "next/server";
import { apiError, hasValidMutationOrigin, noStoreNoContent } from "@/lib/auth/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasValidMutationOrigin(request)) return apiError("FORBIDDEN");
  const locallyBlocked = request.cookies.get("pwa-utt-logout-blocked")?.value === "1";
  const auth = createRequestSupabaseClient(request);
  const { error } = await auth.client.auth.signOut({ scope: "local" });
  if (error && error.name !== "AuthSessionMissingError") {
    return locallyBlocked ? apiError("UNAVAILABLE") : auth.withCookies(apiError("UNAVAILABLE"));
  }
  // An offline logout may finish after a new login in another tab. Its response
  // must not overwrite that newer session's cookies; the local gate stays shut.
  return locallyBlocked ? noStoreNoContent() : auth.withCookies(noStoreNoContent());
}
