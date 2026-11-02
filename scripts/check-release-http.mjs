// Narrow #108 image/HTTP probe; the full W10 smoke/rollback suite belongs to #111.
import assert from "node:assert/strict";

const base = new URL(process.env.W10_BASE_URL || "http://invalid.invalid");
assert.ok(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
  && base.pathname === "/" && !base.username && !base.password && !base.search && !base.hash,
"W10_BASE_URL must be an HTTP loopback origin");
const commitSha = process.env.W10_EXPECTED_SHA;
assert.match(commitSha ?? "", /^[0-9a-f]{40}$/i, "W10_EXPECTED_SHA must be a full Git SHA");

async function request(path, timeout = 5_000) {
  const response = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(timeout) });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text };
}

// Retry only connection failures at startup, within a total 30s budget.
const deadline = Date.now() + 30_000;
for (;;) {
  try { await request("/login", Math.max(1, Math.min(5_000, deadline - Date.now()))); break; }
  catch (error) {
    if (Date.now() >= deadline) throw error;
    await new Promise(resolve => setTimeout(resolve, Math.min(250, deadline - Date.now())));
  }
}

const health = await request("/api/health");
assert.equal(health.status, 200, "health status");
assert.match(health.headers.get("content-type") ?? "", /application\/json/i);
assert.equal(health.headers.get("cache-control"), "no-store");
assert.deepEqual(JSON.parse(health.text), { status: "ok", commitSha });
for (const path of ["/login", "/offline"]) {
  const page = await request(path);
  assert.equal(page.status, 200, path);
  assert.match(page.headers.get("content-type") ?? "", /text\/html/i, path);
  assert.match(page.text, /<html/i, path);
}
const root = await request("/");
assert.equal(root.status, 307, "anonymous root");
assert.equal(new URL(root.headers.get("location"), base).pathname, "/login");
const session = await request("/api/session");
assert.equal(session.status, 401, "anonymous session (requires valid synthetic server config)");
assert.match(session.headers.get("content-type") ?? "", /application\/json/i);
assert.ok(JSON.parse(session.text));

const manifest = await request("/offline-assets.json");
assert.equal(manifest.status, 200);
const { assets } = JSON.parse(manifest.text);
assert.ok(Array.isArray(assets) && assets.length > 0, "postbuild must list assets");
for (const asset of assets) {
  assert.match(asset, /^\/_next\/static\/[^?#]+\.(js|css)$/);
  assert.equal(new URL(asset, base).origin, base.origin);
  const response = await request(asset);
  assert.equal(response.status, 200, asset);
  assert.ok(response.text.length > 0, asset);
  assert.match(response.headers.get("content-type") ?? "", asset.endsWith(".css") ? /text\/css/i : /javascript/i, asset);
}
const workerBuild = await request("/sw-build.js");
assert.equal(workerBuild.status, 200);
const buildMatch = /^self\.PWA_BUILD_ID = ("[^"\n]+");\s*$/.exec(workerBuild.text);
assert.ok(buildMatch, "postbuild must expose the Next BUILD_ID");
const buildId = JSON.parse(buildMatch[1]);
if (process.env.W10_EXPECTED_BUILD_ID) assert.equal(buildId, process.env.W10_EXPECTED_BUILD_ID);
assert.equal((await request("/sw.js")).status, 200);
console.log(JSON.stringify({ status: "pass", commitSha, buildId, assets: assets.length, baseUrl: base.origin }));
