export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/** Public liveness and build identity only; never queries Supabase. */
export function GET() {
  const commitSha = process.env.W10_COMMIT_SHA;
  const headers = { "Cache-Control": "no-store" };
  if (!commitSha || !/^[0-9a-f]{40}$/i.test(commitSha)) {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
  return Response.json({ status: "ok", commitSha }, { headers });
}
