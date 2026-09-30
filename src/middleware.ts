import { NextResponse, type NextRequest } from "next/server";
import { inspections } from "@/features/inspections/data/inspections";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

const knownInspectionIds = new Set(inspections.map(({ id }) => id));

/** Refresh cookie sessions before Server Components read them; retain the synthetic route's 404. */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/inspecciones" || pathname === "/__inspection_not_found__") return NextResponse.next();
  if (pathname.startsWith("/inspecciones/")) {
    if (knownInspectionIds.has(pathname.slice("/inspecciones/".length))) return NextResponse.next();
    return NextResponse.rewrite(new URL("/__inspection_not_found__", request.url), { status: 404 });
  }
  const auth = createRequestSupabaseClient(request);
  await auth.client.auth.getUser();
  return auth.withCookies(NextResponse.next({ request: { headers: request.headers } }));
}

export const config = {
  matcher: ["/((?!api|_next|offline|favicon.ico|manifest.webmanifest|sw.js|icons).*)"],
};
