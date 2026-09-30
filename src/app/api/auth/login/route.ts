import { type NextRequest } from "next/server";
import { apiError, privateJson, readJsonMutation } from "@/lib/auth/http";
import { readSession } from "@/lib/auth/session-store";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isCredentials(value: unknown): value is { email: string; password: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).every((key) => key === "email" || key === "password") &&
    typeof body.email === "string" && body.email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) &&
    typeof body.password === "string" && body.password.length > 0 && body.password.length <= 1024;
}

export async function POST(request: NextRequest) {
  const parsed = await readJsonMutation(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  if (!isCredentials(body)) return apiError("INVALID_REQUEST");

  const auth = createRequestSupabaseClient(request);
  const { error } = await auth.client.auth.signInWithPassword({
    email: body.email.trim(),
    password: body.password,
  });
  if (error) {
    const upstreamStatus = error.status ?? 0;
    const status = upstreamStatus === 429 ? 429 : upstreamStatus === 0 || upstreamStatus >= 500 ? 503 : 401;
    const code = status === 429 ? "RATE_LIMITED" : status === 503 ? "UNAVAILABLE" : "AUTH_DENIED";
    return auth.withCookies(apiError(code));
  }

  const session = await readSession(auth.client);
  if (!session) {
    await auth.client.auth.signOut({ scope: "local" });
    return auth.withCookies(apiError("AUTH_DENIED"));
  }
  return auth.withCookies(privateJson(session));
}
