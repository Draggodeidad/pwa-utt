import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session-store";
import { hasEditableInspection, hasVisibleInspection } from "@/lib/repositories/inspections";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

/** Refresh cookies and redirect early; pages and RLS still enforce domain access. */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/login") return NextResponse.next();
  if (request.cookies.get("pwa-utt-logout-blocked")?.value === "1") {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const auth = createRequestSupabaseClient(request);
  const session = await readSession(auth.client);
  if (!session) return auth.withCookies(NextResponse.redirect(new URL("/login", request.url)));
  const coordinatorRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/") ||
    pathname === "/findings" || pathname.startsWith("/findings/");
  const technicianRoute = pathname === "/" ||
    pathname === "/inspections/new" || pathname.startsWith("/inspections/new/") ||
    /^\/inspections\/[^/]+\/edit(?:\/|$)/.test(pathname);
  if (coordinatorRoute && session.user.role !== "coordinator") {
    return auth.withCookies(NextResponse.redirect(new URL("/", request.url)));
  }
  if (technicianRoute && session.user.role !== "technician") {
    return auth.withCookies(NextResponse.redirect(new URL("/dashboard", request.url)));
  }
  const academicId = pathname.startsWith("/inspecciones/") ? pathname.slice("/inspecciones/".length) : null;
  const operationalMatch = /^\/inspections\/([^/]+)(?:\/(edit))?\/?$/.exec(pathname);
  const operationalId = operationalMatch?.[1] === "new" ? null : operationalMatch?.[1];
  if (academicId || operationalId) {
    try {
      const id = academicId ?? operationalId!;
      const visible = operationalMatch?.[2] === "edit"
        ? await hasEditableInspection(auth.client, id, session.user.id)
        : await hasVisibleInspection(auth.client, id);
      if (!visible) {
        return auth.withCookies(NextResponse.rewrite(new URL("/__inspection_not_found__", request.url), { status: 404 }));
      }
    } catch {
      return auth.withCookies(new NextResponse("Servicio no disponible", { status: 503 }));
    }
  }
  return auth.withCookies(NextResponse.next({ request: { headers: request.headers } }));
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|offline$|favicon\\.ico$|manifest\\.webmanifest$|sw\\.js$|sw-build\\.js$|offline-assets\\.json$|apple-touch-icon\\.png$|icons/|inspection-assets/|screenshots/).*)"],
};
