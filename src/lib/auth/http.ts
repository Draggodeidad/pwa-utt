import { type NextRequest, NextResponse } from "next/server";

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
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
