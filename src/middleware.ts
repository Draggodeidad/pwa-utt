import { NextResponse, type NextRequest } from "next/server";
import { inspections } from "@/features/inspections/data/inspections";

const knownInspectionIds = new Set(inspections.map(({ id }) => id));

/** Reject unknown synthetic IDs before a loading boundary starts streaming a 200 response. */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/inspecciones") return NextResponse.next();
  const id = pathname.slice("/inspecciones/".length);
  if (knownInspectionIds.has(id)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/__inspection_not_found__", request.url), { status: 404 });
}

export const config = {
  matcher: "/inspecciones/:path*",
};
