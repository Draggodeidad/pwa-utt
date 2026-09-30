import { type NextRequest } from "next/server";
import { hasValidMutationOrigin, privateJson } from "@/lib/auth/http";
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
  if (!hasValidMutationOrigin(request)) return privateJson({ error: "Origen no permitido" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return privateJson({ error: "Solicitud no válida" }, 422);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return privateJson({ error: "Solicitud no válida" }, 422);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) return privateJson({ error: "Solicitud no válida" }, 422);
    body = JSON.parse(text);
  } catch {
    return privateJson({ error: "Solicitud no válida" }, 422);
  }
  if (!isCredentials(body)) return privateJson({ error: "Solicitud no válida" }, 422);

  const auth = createRequestSupabaseClient(request);
  const { error } = await auth.client.auth.signInWithPassword({
    email: body.email.trim(),
    password: body.password,
  });
  if (error) {
    const upstreamStatus = error.status ?? 0;
    const status = upstreamStatus === 429 ? 429 : upstreamStatus === 0 || upstreamStatus >= 500 ? 503 : 401;
    const message = status === 429 ? "Intenta más tarde" : status === 503 ? "Servicio no disponible" : "Acceso no concedido";
    return auth.withCookies(privateJson({ error: message }, status));
  }

  const session = await readSession(auth.client);
  if (!session) {
    await auth.client.auth.signOut({ scope: "local" });
    return auth.withCookies(privateJson({ error: "Acceso no concedido" }, 401));
  }
  return auth.withCookies(privateJson(session));
}
