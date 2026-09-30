// HTTP contract tests against a local Supabase Auth/PostgREST stand-in. No real credentials are used.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const { resolve } = require("node:path");
const { once } = require("node:events");

const root = resolve(__dirname, "..");
const production = process.env.AUTH_TEST_PRODUCTION === "1";
const technicianId = "11111111-1111-4111-8111-111111111111";
const inactiveId = "22222222-2222-4222-8222-222222222222";
const refreshId = "33333333-3333-4333-8333-333333333333";
const accounts = {
  "tech@example.invalid": { id: technicianId, password: "synthetic-password", active: true },
  "inactive@example.invalid": { id: inactiveId, password: "synthetic-password", active: false },
  "refresh@example.invalid": { id: refreshId, password: "synthetic-password", active: true },
};
const revoked = new Set();
let refreshCount = 0;

function token(userId, expiry) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiry, role: "authenticated" })).toString("base64url");
  return `${header}.${payload}.synthetic-signature`;
}
function authUser(account, email) {
  return { id: account.id, aud: "authenticated", role: "authenticated", email,
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
    created_at: "2026-01-01T00:00:00Z" };
}
function session(account, email, lifetime = 3600) {
  const expiry = Math.floor(Date.now() / 1000) + lifetime;
  return { access_token: token(account.id, expiry), refresh_token: `refresh-${account.id}`,
    token_type: "bearer", expires_in: lifetime, expires_at: expiry, user: authUser(account, email) };
}
function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
}
function accountFromBearer(req) {
  const bearer = (req.headers.authorization || "").replace(/^Bearer /i, "");
  if (revoked.has(bearer)) return null;
  let subject;
  try { subject = JSON.parse(Buffer.from(bearer.split(".")[1], "base64url").toString()).sub; } catch { return null; }
  const entry = Object.entries(accounts).find(([, account]) => account.id === subject);
  return entry ? { email: entry[0], account: entry[1], bearer } : null;
}
const backend = createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock.invalid");
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
    const input = await readJson(req);
    const account = accounts[input.email];
    if (!account || account.password !== input.password) return send(res, 400, { code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(res, 200, session(account, input.email, input.email === "refresh@example.invalid" ? 1 : 3600));
  }
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
    const input = await readJson(req);
    const entry = Object.entries(accounts).find(([, account]) => input.refresh_token === `refresh-${account.id}`);
    if (!entry) return send(res, 400, { code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
    refreshCount++;
    return send(res, 200, session(entry[1], entry[0]));
  }
  if (url.pathname === "/auth/v1/user") {
    const entry = accountFromBearer(req);
    return entry ? send(res, 200, authUser(entry.account, entry.email)) : send(res, 401, { msg: "Invalid JWT" });
  }
  if (url.pathname === "/auth/v1/logout") {
    const entry = accountFromBearer(req);
    if (entry) revoked.add(entry.bearer);
    res.writeHead(204); res.end(); return;
  }
  if (url.pathname === "/rest/v1/profiles") {
    const entry = accountFromBearer(req);
    if (!entry) return send(res, 401, { code: "PGRST301", message: "JWT invalid" });
    return send(res, 200, [{ id: entry.account.id, display_name: entry.account.active ? "Técnica de prueba" : "Cuenta inactiva",
      role: "technician", active: entry.account.active }]);
  }
  return send(res, 404, { message: "Not found" });
});

async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port; server.close(); await once(server, "close"); return port;
}
function cookiesFrom(response, jar) {
  for (const value of response.headers.getSetCookie()) {
    const first = value.split(";", 1)[0];
    const separator = first.indexOf("=");
    const name = first.slice(0, separator), content = first.slice(separator + 1);
    if (content) jar.set(name, content); else jar.delete(name);
  }
}
async function main() {
  backend.listen(0, "127.0.0.1"); await once(backend, "listening");
  const supabaseUrl = `http://127.0.0.1:${backend.address().port}`;
  const appPort = await freePort();
  const base = `http://127.0.0.1:${appPort}`;
  const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: "synthetic-anon-key" },
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-2000); });
  child.stderr.on("data", (chunk) => { output = `${output}${chunk}`.slice(-2000); });
  const request = async (path, options = {}, jar) => {
    const headers = { ...(options.headers || {}) };
    if (jar?.size) headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(base + path, { ...options, headers, redirect: "manual", signal: AbortSignal.timeout(15000) });
    if (jar) cookiesFrom(response, jar);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
    if (path.startsWith("/api/")) assert.equal(response.headers.get("cache-control"), "private, no-store");
    return response;
  };
  try {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Next terminated: ${output}`);
      try { const ready = await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) }); if (ready.ok) break; } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    const anonymous = await request("/api/session");
    assert.equal(anonymous.status, 401);
    assert.equal((await request("/api/auth/logout", { method: "POST", headers: { Origin: "https://foreign.invalid" } })).status, 403);
    assert.equal((await request("/api/auth/logout", { method: "POST" })).status, 403);
    assert.equal((await request("/api/auth/login", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: "{}" })).status, 422);
    const login = (email, password, jar) => request("/api/auth/login", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }, jar);
    assert.equal((await login("tech@example.invalid", "wrong", new Map())).status, 401);
    const inactiveJar = new Map();
    assert.equal((await login("inactive@example.invalid", "synthetic-password", inactiveJar)).status, 401);
    assert.equal((await request("/api/session", {}, inactiveJar)).status, 401);
    const jar = new Map();
    const authenticated = await login("tech@example.invalid", "synthetic-password", jar);
    assert.equal(authenticated.status, 200);
    const sessionBody = await authenticated.json();
    assert.equal(sessionBody.user.displayName, "Técnica de prueba");
    assert.equal(sessionBody.user.role, "technician");
    assert.doesNotMatch(JSON.stringify(sessionBody), /access_token|refresh_token|password/i);
    const setCookies = authenticated.headers.getSetCookie();
    assert.ok(setCookies.length > 0);
    for (const cookie of setCookies) {
      assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i);
      if (production) assert.match(cookie, /; Secure/i);
      else assert.doesNotMatch(cookie, /; Secure/i);
    }
    assert.equal((await request("/api/session", {}, jar)).status, 200);
    const profile = await request("/profile", {}, jar);
    assert.equal(profile.status, 200);
    assert.match(await profile.text(), /Técnica de prueba/);
    assert.equal((await request("/api/auth/logout", { method: "POST", headers: { Origin: base } }, jar)).status, 204);
    assert.equal((await request("/api/session", {}, jar)).status, 401);
    assert.equal((await request("/api/auth/logout", { method: "POST", headers: { Origin: base } }, jar)).status, 204);

    const refreshJar = new Map();
    assert.equal((await login("refresh@example.invalid", "synthetic-password", refreshJar)).status, 200);
    await new Promise((resolveWait) => setTimeout(resolveWait, 1300));
    const renewed = await request("/api/session", {}, refreshJar);
    assert.equal(renewed.status, 200);
    assert.ok(refreshCount > 0, "expired access token used the refresh token");
    assert.ok(Date.parse((await renewed.json()).expiresAt) > Date.now());
    console.log("auth.spec.ts: PASS");
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((done) => setTimeout(done, 5000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
    backend.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
