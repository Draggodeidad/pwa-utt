import { type NextRequest, NextResponse } from "next/server";

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export type ApiErrorCode = "AUTH_DENIED" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID_REQUEST" | "RATE_LIMITED" | "UNAVAILABLE";
const errors: Record<ApiErrorCode, { status: number; message: string }> = {
  AUTH_DENIED: { status: 401, message: "Acceso no concedido" },
  UNAUTHENTICATED: { status: 401, message: "Sesión no disponible" },
  FORBIDDEN: { status: 403, message: "Acceso no permitido" },
  NOT_FOUND: { status: 404, message: "Recurso no disponible" },
  CONFLICT: { status: 409, message: "Conflicto de versión o estado" },
  INVALID_REQUEST: { status: 422, message: "Solicitud no válida" },
  RATE_LIMITED: { status: 429, message: "Intenta más tarde" },
  UNAVAILABLE: { status: 503, message: "Servicio no disponible" },
};

/** A transport error keeps the HTTP status of its code while preserving domain details. */
export type ApiErrorDetails = {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export function apiError(code: ApiErrorCode, details?: ApiErrorDetails) {
  const { status, message } = errors[code];
  return privateJson({
    code: details?.code ?? code,
    error: details?.message ?? message,
    ...(details?.fieldErrors ? { fieldErrors: details.fieldErrors } : {}),
  }, status);
}

/** Flattens validation issues into the fieldErrors contract without exposing internals. */
export function toFieldErrors(error: { issues: readonly { path: string; message: string }[] }): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path] = issue.message;
  return fieldErrors;
}

/** Reject cross-origin and oversized JSON before parsing a cookie-authenticated mutation. */
export async function readJsonMutation(request: NextRequest, maxLength = 4096): Promise<{ body: unknown; error?: never } | { body?: never; error: NextResponse }> {
  if (!hasValidMutationOrigin(request)) return { error: apiError("FORBIDDEN") };
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return { error: apiError("INVALID_REQUEST") };
  if (Number(request.headers.get("content-length") ?? 0) > maxLength) return { error: apiError("INVALID_REQUEST") };
  try {
    const bodyText = await request.text();
    if (bodyText.length > maxLength) return { error: apiError("INVALID_REQUEST") };
    return { body: JSON.parse(bodyText) as unknown };
  } catch {
    return { error: apiError("INVALID_REQUEST") };
  }
}

/** Browser credential mutations must originate on the same origin, including on first login. */
export function hasValidMutationOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === host && parsed.protocol === request.nextUrl.protocol;
  } catch {
    return false;
  }
}

export function noStoreNoContent() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
}
