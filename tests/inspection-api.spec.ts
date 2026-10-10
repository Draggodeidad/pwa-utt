// HTTP contract tests for the inspection API against a local Supabase
// Auth/PostgREST/RPC stand-in. No real credentials or project are used.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const { resolve } = require("node:path");
const { once } = require("node:events");

const root = resolve(__dirname, "..");
const production = process.env.AUTH_TEST_PRODUCTION === "1";

const technicianId = "11111111-1111-4111-8111-111111111111";
const coordinatorId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const laboratoryId = "44444444-4444-4444-8444-444444444444";
const techDraftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const techCompletedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const foreignDraftId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const foreignCompletedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const findingId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const clientId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const op = (n) => `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`;

const accounts = {
  "tech@example.invalid": { id: technicianId, role: "technician", name: "Técnica de prueba" },
  "coord@example.invalid": { id: coordinatorId, role: "coordinator", name: "Coordinación de prueba" },
  "other@example.invalid": { id: otherId, role: "technician", name: "Otra persona" },
};
const laboratories = [{ id: laboratoryId, code: "LAB-01", name: "Laboratorio 01", active: true }];
const inspections = [
  { id: techDraftId, folio_number: 101, laboratory_id: laboratoryId, inspector_id: technicianId, inspection_date: "2026-09-20", summary: "Borrador propio", workflow_status: "draft", version: 1, created_at: "2026-09-20T10:00:00Z", updated_at: "2026-09-20T10:00:00Z", completed_at: null, deleted_at: null },
  { id: techCompletedId, folio_number: 102, laboratory_id: laboratoryId, inspector_id: technicianId, inspection_date: "2026-09-19", summary: "Completada propia", workflow_status: "completed", version: 2, created_at: "2026-09-19T10:00:00Z", updated_at: "2026-09-19T11:00:00Z", completed_at: "2026-09-19T11:00:00Z", deleted_at: null },
  { id: foreignDraftId, folio_number: 103, laboratory_id: laboratoryId, inspector_id: otherId, inspection_date: "2026-09-18", summary: "Borrador ajeno", workflow_status: "draft", version: 1, created_at: "2026-09-18T10:00:00Z", updated_at: "2026-09-18T10:00:00Z", completed_at: null, deleted_at: null },
  { id: foreignCompletedId, folio_number: 104, laboratory_id: laboratoryId, inspector_id: otherId, inspection_date: "2026-09-17", summary: "Completada ajena", workflow_status: "completed", version: 3, created_at: "2026-09-17T10:00:00Z", updated_at: "2026-09-17T11:00:00Z", completed_at: "2026-09-17T11:00:00Z", deleted_at: null },
];
const findings = [
  { id: findingId, inspection_id: techCompletedId, title: "Cableado expuesto", description: "Cable de prueba", priority: "medium", status: "pending", deleted_at: null },
];
const locations = new Map();
const gps = { latitude: 19.4326, longitude: -99.1332, accuracy: 12.5, capturedAt: "2026-10-09T12:00:00.000Z" };
const receipts = new Map();
let nextFolio = 200;

function nowIso() { return new Date().toISOString(); }
function raise(message) { throw new Error(message); }
function token(id) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })).toString("base64url");
  return `${header}.${payload}.synthetic-signature`;
}
function user(account, email) {
  return { id: account.id, aud: "authenticated", role: "authenticated", email, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
}
function bearerAccount(req) {
  try {
    const payload = JSON.parse(Buffer.from((req.headers.authorization || "").split(".")[1], "base64url").toString());
    return Object.entries(accounts).find(([, account]) => account.id === payload.sub);
  } catch { return undefined; }
}
function send(res, status, body) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); }
function parseValue(value) {
  let s = value.trim();
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s;
}
function splitTop(expr) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    else if (expr[i] === "," && depth === 0) { parts.push(expr.slice(start, i)); start = i + 1; }
  }
  parts.push(expr.slice(start));
  return parts.filter(Boolean);
}
function simpleMatch(row, term) {
  const parts = term.split(".");
  const col = parts[0];
  if (parts[1] === "is") return row[col] === null;
  const op = parts[1];
  const value = parseValue(parts.slice(2).join("."));
  const current = row[col];
  switch (op) {
    case "eq": return current === null ? false : String(current) === value;
    case "lt": return current === null ? false : String(current) < value;
    case "ilike": {
      const pattern = value.slice(1, -1).replace(/\\%/g, "%").replace(/\\_/g, "_").replace(/\\\\/g, "\\");
      return typeof current === "string" && current.toLowerCase().includes(pattern.toLowerCase());
    }
    default: return false;
  }
}
function orMatch(row, expr) {
  return splitTop(expr).some((term) => {
    if (term.startsWith("and(") && term.endsWith(")")) {
      return splitTop(term.slice(4, -1)).every((sub) => simpleMatch(row, sub));
    }
    return simpleMatch(row, term);
  });
}
function filterById(items, value, key) {
  if (!value) return items;
  if (value.startsWith("eq.")) return items.filter((item) => item[key] === value.slice(3));
  if (value.startsWith("in.(")) return items.filter((item) => value.slice(4, -1).split(",").includes(item[key]));
  return items;
}
function accountById(id) { return Object.values(accounts).find((account) => account.id === id); }
function visibleInspections(actorId) {
  const role = accountById(actorId)?.role;
  const active = inspections.filter((row) => row.deleted_at === null);
  return role === "coordinator" ? active.filter((row) => row.workflow_status === "completed") : active.filter((row) => row.inspector_id === actorId);
}
function queryInspections(url) {
  const params = url.searchParams;
  let rows = visibleInspections(queryInspections.actor);
  rows = filterById(rows, params.get("id"), "id");
  if (params.get("deleted_at") === "is.null") rows = rows.filter((row) => row.deleted_at === null);
  const status = params.get("workflow_status");
  if (status?.startsWith("eq.")) rows = rows.filter((row) => row.workflow_status === status.slice(3));
  const summary = params.get("summary");
  if (summary?.startsWith("ilike.")) rows = rows.filter((row) => simpleMatch(row, `summary.ilike.${summary.slice("ilike.".length)}`));
  const orFilter = params.get("or");
  if (orFilter) {
    const expr = orFilter.startsWith("(") && orFilter.endsWith(")") ? orFilter.slice(1, -1) : orFilter;
    rows = rows.filter((row) => orMatch(row, expr));
  }
  const order = params.get("order");
  if (order) {
    const columns = order.split(",").map((part) => part.split("."));
    rows = rows.sort((a, b) => {
      for (const [col, dir] of columns) {
        const asc = dir !== "desc";
        const aNull = a[col] === null || a[col] === undefined;
        const bNull = b[col] === null || b[col] === undefined;
        if (aNull || bNull) { if (aNull && bNull) continue; return aNull ? 1 : -1; }
        if (a[col] < b[col]) return asc ? -1 : 1;
        if (a[col] > b[col]) return asc ? 1 : -1;
      }
      return 0;
    });
  }
  const limit = params.get("limit");
  if (limit) rows = rows.slice(0, Number(limit));
  return rows;
}
function applyInspectionKind(actor, op) {
  const { kind, entityId, baseVersion, payload } = op;
  if (kind === "inspection.create") {
    if (baseVersion !== null) raise("FORBIDDEN_OR_INVALID_INPUT");
    for (const key of Object.keys(payload || {})) if (!["laboratoryId", "inspectionDate", "summary"].includes(key)) raise("FORBIDDEN_OR_INVALID_INPUT");
    if (payload.laboratoryId != null && !laboratories.some((lab) => lab.id === payload.laboratoryId && lab.active)) raise("INVALID_LABORATORY");
    const row = {
      id: entityId, folio_number: nextFolio++, laboratory_id: payload.laboratoryId ?? null,
      inspector_id: actor, inspection_date: payload.inspectionDate ?? null,
      summary: payload.summary ?? "", workflow_status: "draft", version: 1,
      created_at: nowIso(), updated_at: nowIso(), completed_at: null, deleted_at: null,
    };
    inspections.push(row);
    return row;
  }
  const row = inspections.find((item) => item.id === entityId);
  if (!row || row.inspector_id !== actor || row.deleted_at !== null) raise("NOT_FOUND");
  if (row.workflow_status !== "draft" || baseVersion !== row.version) raise("VERSION_OR_STATE_CONFLICT");
  if (kind === "inspection.update") {
    for (const key of Object.keys(payload || {})) if (!["laboratoryId", "inspectionDate", "summary"].includes(key)) raise("INVALID_INPUT");
    if (payload.laboratoryId != null && !laboratories.some((lab) => lab.id === payload.laboratoryId && lab.active)) raise("INVALID_LABORATORY");
    if ("laboratoryId" in payload) row.laboratory_id = payload.laboratoryId ?? null;
    if ("inspectionDate" in payload) row.inspection_date = payload.inspectionDate ?? null;
    if ("summary" in payload) row.summary = payload.summary ?? "";
    row.version += 1; row.updated_at = nowIso();
    return row;
  }
  if (kind === "inspection.discard") {
    if (Object.keys(payload || {}).length) raise("INVALID_INPUT");
    row.deleted_at = nowIso(); row.version += 1; row.updated_at = nowIso();
    return row;
  }
  if (kind === "inspection.finalize") {
    if (Object.keys(payload || {}).some((key) => !["expectedFindingIds", "location"].includes(key))) raise("INVALID_INPUT");
    if (!Array.isArray(payload?.expectedFindingIds)) raise("INVALID_INPUT");
    const expected = [...payload.expectedFindingIds].map(String).sort();
    const actual = findings.filter((finding) => finding.inspection_id === entityId && finding.deleted_at === null).map((finding) => finding.id).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) raise("FINDING_SET_CONFLICT");
    if (row.laboratory_id === null || row.inspection_date === null || !String(row.summary).trim() ||
        findings.some((finding) => finding.inspection_id === entityId && finding.deleted_at === null && !String(finding.title).trim())) {
      raise("FINALIZATION_INVALID");
    }
    locations.set(entityId, payload.location ?? null);
    row.workflow_status = "completed"; row.completed_at = nowIso(); row.version += 1; row.updated_at = nowIso();
    return row;
  }
  raise("INVALID_OPERATION");
}

const backend = createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock.invalid");
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
    let body = ""; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body || "{}");
    const account = accounts[input.email];
    if (!account || input.password !== "synthetic-password") return send(res, 400, { code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(res, 200, { access_token: token(account.id), refresh_token: `refresh-${account.id}`, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(account, input.email) });
  }
  if (url.pathname === "/auth/v1/user") {
    const entry = bearerAccount(req);
    return entry ? send(res, 200, user(entry[1], entry[0])) : send(res, 401, { msg: "Invalid JWT" });
  }
  const entry = bearerAccount(req);
  if (!entry) return send(res, 401, { code: "PGRST301", message: "JWT invalid" });
  const account = entry[1];

  if (url.pathname === "/rest/v1/profiles") {
    const profiles = Object.entries(accounts).map(([email, value]) => ({ id: value.id, display_name: value.name, role: value.role, active: true, email }));
    return send(res, 200, filterById(profiles, url.searchParams.get("id"), "id"));
  }
  if (url.pathname === "/rest/v1/laboratories") {
    const rows = filterById(laboratories, url.searchParams.get("id"), "id");
    const active = url.searchParams.get("active");
    return send(res, 200, active === "eq.true" ? rows.filter((lab) => lab.active) : rows);
  }
  if (url.pathname === "/rest/v1/findings") {
    let rows = findings.filter((finding) => finding.deleted_at === null);
    rows = filterById(rows, url.searchParams.get("inspection_id"), "inspection_id");
    return send(res, 200, rows);
  }
  if (url.pathname === "/rest/v1/inspection_locations") {
    const visible = new Set(visibleInspections(account.id).map(row => row.id));
    const rows = account.role === "coordinator" ? [...locations.entries()].filter(([id]) => visible.has(id)).map(([inspection_id, value]) => ({ inspection_id, ...(value ? { ...value, captured_at: value.capturedAt } : { latitude: null, longitude: null, accuracy: null, captured_at: null }) })) : [];
    return send(res, 200, filterById(rows, url.searchParams.get("inspection_id"), "inspection_id"));
  }
  if (url.pathname === "/rest/v1/inspections") {
    queryInspections.actor = account.id;
    return send(res, 200, queryInspections(url));
  }
  if (url.pathname === "/rest/v1/rpc/apply_operation") {
    let body = ""; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body || "{}");
    const { p_operation_id, p_client_id, p_kind, p_entity_id, p_base_version, p_payload } = input;
    const requestKey = `${account.id}:${p_operation_id}`;
    const normalized = { kind: p_kind, entityId: p_entity_id, clientId: p_client_id, baseVersion: p_base_version, payload: p_payload ?? {} };
    if (account.role !== "technician") return send(res, 400, { code: "P0001", message: "FORBIDDEN" });
    const existing = receipts.get(requestKey);
    if (existing) {
      if (JSON.stringify(existing.request) !== JSON.stringify(normalized)) return send(res, 400, { code: "P0001", message: "IDEMPOTENCY_KEY_REUSED" });
      return send(res, 200, { ...existing.result, __replayed: true });
    }
    let result;
    try { result = applyInspectionKind(account.id, normalized); }
    catch (error) { return send(res, 400, { code: "P0001", message: error.message }); }
    receipts.set(requestKey, { request: normalized, result });
    return send(res, 200, { ...result, __replayed: false });
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
    const login = (email, jar) => request("/api/auth/login", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "synthetic-password" }) }, jar);
    const mutation = (method, path, jar, body, operationId) => request(path, {
      method,
      headers: { Origin: base, "Content-Type": "application/json", ...(operationId ? { "Idempotency-Key": operationId } : {}) },
      body: JSON.stringify(body),
    }, jar);

    assert.equal((await request("/api/inspections")).status, 401);
    assert.equal((await request("/api/laboratories")).status, 401);

    const tech = new Map();
    assert.equal((await login("tech@example.invalid", tech)).status, 200);

    const labs = await request("/api/laboratories", {}, tech);
    assert.equal(labs.status, 200);
    assert.equal((await labs.json()).length, 1);

    const initialList = await (await request("/api/inspections", {}, tech)).json();
    const initialIds = initialList.items.map((item) => item.id);
    assert.ok(initialIds.includes(techDraftId) && initialIds.includes(techCompletedId), "técnico ve sus inspecciones");
    assert.ok(!initialIds.includes(foreignDraftId) && !initialIds.includes(foreignCompletedId), "no filtra inspecciones ajenas");

    const newId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";
    const createBody = { clientId, kind: "inspection.create", entityId: newId, payload: { laboratoryId, inspectionDate: "2026-09-22", summary: "Revisión nueva" } };
    const created = await mutation("PUT", `/api/inspections/${newId}`, tech, createBody, op(1));
    assert.equal(created.status, 201, "PUT válido devuelve 201");
    const createdAck = await created.json();
    assert.equal(createdAck.operationId, op(1));
    assert.equal(createdAck.entityId, newId);
    assert.equal(createdAck.version, 1);
    assert.equal(createdAck.entityType, "inspection");
    assert.equal(createdAck.replayed, false);

    const detail = await (await request(`/api/inspections/${newId}`, {}, tech)).json();
    assert.equal(detail.id, newId, "GET tras la petición recupera el mismo UUID");
    const afterList = await (await request("/api/inspections?limit=100", {}, tech)).json();
    assert.ok(afterList.items.some((item) => item.id === newId), "el listado incluye la nueva inspección");

    const replayed = await mutation("PUT", `/api/inspections/${newId}`, tech, createBody, op(1));
    assert.equal(replayed.status, 200, "misma key+payload devuelve ACK anterior");
    const replayedAck = await replayed.json();
    assert.equal(replayedAck.version, 1, "el replay no re-aplica la creación");
    assert.equal(replayedAck.replayed, true);

    const reused = await mutation("PUT", `/api/inspections/${newId}`, tech, { ...createBody, payload: { ...createBody.payload, summary: "Contenido distinto" } }, op(1));
    assert.equal(reused.status, 409, "misma key con distinto contenido es 409");
    assert.equal((await reused.json()).code, "IDEMPOTENCY_KEY_REUSED");

    const patched = await mutation("PATCH", `/api/inspections/${newId}`, tech, { clientId, kind: "inspection.update", entityId: newId, baseVersion: 1, payload: { summary: "Revisión nueva editada" } }, op(2));
    assert.equal(patched.status, 201, "PATCH válido incrementa versión");
    assert.equal((await patched.json()).version, 2);

    const stale = await mutation("PATCH", `/api/inspections/${newId}`, tech, { clientId, kind: "inspection.update", entityId: newId, baseVersion: 1, payload: { summary: "Versión obsoleta" } }, op(3));
    assert.equal(stale.status, 409, "PATCH con versión vieja es 409");
    assert.equal((await stale.json()).code, "VERSION_CONFLICT");

    assert.equal((await mutation("PATCH", `/api/inspections/${foreignDraftId}`, tech, { clientId, kind: "inspection.update", entityId: foreignDraftId, baseVersion: 1, payload: { summary: "Intrusión" } }, op(4))).status, 404, "entidad ajena 404 sin filtración");
    assert.equal((await request(`/api/inspections/${foreignDraftId}`, {}, tech)).status, 404);

    const discarded = await mutation("DELETE", `/api/inspections/${newId}`, tech, { clientId, kind: "inspection.discard", entityId: newId, baseVersion: 2, payload: {} }, op(5));
    assert.equal(discarded.status, 201);
    const discardedAck = await discarded.json();
    assert.equal(discardedAck.version, 3);
    assert.equal((await request(`/api/inspections/${newId}`, {}, tech)).status, 404, "el descarte elimina la inspección");

    const discardRetry = await mutation("DELETE", `/api/inspections/${newId}`, tech, { clientId, kind: "inspection.discard", entityId: newId, baseVersion: 2, payload: {} }, op(5));
    assert.equal(discardRetry.status, 200, "el retry devuelve el ACK anterior");
    assert.equal((await discardRetry.json()).version, 3);
    assert.equal((await request(`/api/inspections/${newId}`, {}, tech)).status, 404, "el retry no resucita la entidad");

    const discardFresh = await mutation("DELETE", `/api/inspections/${newId}`, tech, { clientId, kind: "inspection.discard", entityId: newId, baseVersion: 2, payload: {} }, op(6));
    assert.equal(discardFresh.status, 404, "descarte nuevo sobre borrador descartado es 404");
    assert.equal((await request(`/api/inspections/${newId}`, {}, tech)).status, 404, "no hay resurrección");

    const invalidKind = await mutation("PUT", `/api/inspections/${newId}`, tech, { clientId, kind: "inspection.update", entityId: newId, payload: {} }, op(7));
    assert.equal(invalidKind.status, 422, "kind incorrecto para el endpoint es 422");
    assert.equal((await invalidKind.json()).code, "VALIDATION_ERROR");

    const missingKey = await mutation("PUT", `/api/inspections/${newId}`, tech, { clientId, kind: "inspection.create", entityId: newId, payload: {} });
    assert.equal(missingKey.status, 422, "Idempotency-Key ausente es 422");

    const finalizeId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02";
    const finalizeDraft = await mutation("PUT", `/api/inspections/${finalizeId}`, tech, { clientId, kind: "inspection.create", entityId: finalizeId, payload: { laboratoryId, inspectionDate: "2026-09-23", summary: "Para finalizar" } }, op(8));
    assert.equal(finalizeDraft.status, 201);
    const finalized = await mutation("POST", `/api/inspections/${finalizeId}/finalize`, tech, { clientId, kind: "inspection.finalize", entityId: finalizeId, baseVersion: 1, payload: { expectedFindingIds: [], location: gps } }, op(9));
    assert.equal(finalized.status, 201, "finalize válido completa la inspección");
    const finalAck = await finalized.json();
    assert.ok(!JSON.stringify(finalAck).includes("latitude"), "ACK no devuelve coordenadas");
    const retryGps = await mutation("POST", `/api/inspections/${finalizeId}/finalize`, tech, { clientId, kind: "inspection.finalize", entityId: finalizeId, baseVersion: 1, payload: { expectedFindingIds: [], location: gps } }, op(9));
    assert.equal(retryGps.status, 200);
    assert.equal((await retryGps.json()).replayed, true);

    const afterCapture = await mutation("PATCH", `/api/inspections/${finalizeId}`, tech, { clientId, kind: "inspection.update", entityId: finalizeId, baseVersion: 2, payload: { summary: "Tarde" } }, op(10));
    assert.equal(afterCapture.status, 409, "finalizada bloquea captura posterior");
    const finalizedDetail = await (await request(`/api/inspections/${finalizeId}`, {}, tech)).json();
    assert.equal(finalizedDetail.workflowStatus, "completed");
    assert.ok(!("capturedLocation" in finalizedDetail), "técnico no recibe su GPS");
    assert.ok(!JSON.stringify(await (await request("/api/inspections", {}, tech)).json()).includes("latitude"));
    const techPage = await (await request(`/inspections/${finalizeId}`, {}, tech)).text();
    assert.ok(!techPage.includes("maps?q="), "detalle técnico sin GPS");


    const wrongSetId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03";
    await mutation("PUT", `/api/inspections/${wrongSetId}`, tech, { clientId, kind: "inspection.create", entityId: wrongSetId, payload: { laboratoryId, inspectionDate: "2026-09-24", summary: "Conjunto erróneo" } }, op(11));
    const wrongSet = await mutation("POST", `/api/inspections/${wrongSetId}/finalize`, tech, { clientId, kind: "inspection.finalize", entityId: wrongSetId, baseVersion: 1, payload: { expectedFindingIds: [findingId] } }, op(12));
    assert.equal(wrongSet.status, 409, "expectedFindingIds distinto es 409");
    assert.equal((await wrongSet.json()).code, "FINDING_SET_CONFLICT");

    const incompleteId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04";
    await mutation("PUT", `/api/inspections/${incompleteId}`, tech, { clientId, kind: "inspection.create", entityId: incompleteId, payload: {} }, op(13));
    const incomplete = await mutation("POST", `/api/inspections/${incompleteId}/finalize`, tech, { clientId, kind: "inspection.finalize", entityId: incompleteId, baseVersion: 1, payload: { expectedFindingIds: [] } }, op(14));
    assert.equal(incomplete.status, 422, "finalize sin campos obligatorios es 422");
    assert.equal((await incomplete.json()).code, "VALIDATION_ERROR");

    const searchResult = await (await request("/api/inspections?search=Paginación", {}, tech)).json();
    assert.ok(searchResult.items.length === 0, "la búsqueda no inventa coincidencias");

    for (let i = 1; i <= 3; i++) {
      await mutation("PUT", `/api/inspections/eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1${i}`, tech, { clientId, kind: "inspection.create", entityId: `eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1${i}`, payload: { inspectionDate: `2026-09-2${8 - i}`, summary: `Paginación ${i}` } }, op(15 + i));
    }
    const collected = [];
    let cursor = null;
    let pages = 0;
    do {
      const pageUrl = `/api/inspections?limit=2&status=draft${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const page = await (await request(pageUrl, {}, tech)).json();
      assert.ok(page.items.length <= 2, "página acotada");
      collected.push(...page.items);
      cursor = page.nextCursor;
      pages++;
      assert.ok(pages <= 6, "paginación termina en páginas acotadas");
    } while (cursor);
    assert.equal(collected.length, 6, "todas las inspecciones draft se recorren por cursor");
    assert.equal(new Set(collected.map((item) => item.id)).size, collected.length, "sin duplicados entre páginas");
    assert.ok(collected.some((item) => item.id === techDraftId), "el borrador original se recorre por cursor");

    const invalidParams = await request("/api/inspections?limit=abc", {}, tech);
    assert.equal(invalidParams.status, 422);
    const invalidStatus = await request("/api/inspections?status=archived", {}, tech);
    assert.equal(invalidStatus.status, 422);
    const invalidCursor = await request("/api/inspections?cursor=not-a-cursor", {}, tech);
    assert.equal(invalidCursor.status, 422);

    const coord = new Map();
    assert.equal((await login("coord@example.invalid", coord)).status, 200);
    const coordGps = await (await request(`/api/inspections/${finalizeId}`, {}, coord)).json();
    assert.deepEqual(coordGps.capturedLocation, gps, "coordinador recibe captura persistida");
    const noGps = await (await request(`/api/inspections/${techCompletedId}`, {}, coord)).json();
    assert.equal(noGps.capturedLocation, null, "inspección anterior sin captura");
    for (const prefix of ["/inspections", "/inspecciones"]) {
      const html = await (await request(`${prefix}/${finalizeId}`, {}, coord)).text();
      assert.ok(html.includes("Ubicación de captura") && html.includes("maps?q=19.4326,-99.1332"), "detalle coordinador con mapa");
      const empty = await (await request(`${prefix}/${techCompletedId}`, {}, coord)).text();
      assert.ok(empty.includes("No se registró ubicación GPS"), "estado vacío coordinador");
    }
    const otherTech = new Map();
    await login("other@example.invalid", otherTech);
    assert.equal((await request(`/api/inspections/${finalizeId}`, {}, otherTech)).status, 404);
    const emptyId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee70";
    await mutation("PUT", `/api/inspections/${emptyId}`, tech, { clientId, kind: "inspection.create", entityId: emptyId, payload: { laboratoryId, inspectionDate: "2026-10-09", summary: "Sin GPS" } }, op(70));
    const noCaptureAck = await mutation("POST", `/api/inspections/${emptyId}/finalize`, tech, { clientId, kind: "inspection.finalize", entityId: emptyId, baseVersion: 1, payload: { expectedFindingIds: [], location: null } }, op(71));
    assert.equal(noCaptureAck.status, 201, "sin ubicación se finaliza normalmente");
    assert.equal((await (await request(`/api/inspections/${emptyId}`, {}, coord)).json()).capturedLocation, null);
    const coordList = await (await request("/api/inspections", {}, coord)).json();
    assert.ok(coordList.items.length > 0 && coordList.items.every((item) => item.workflowStatus === "completed"), "coordinación solo lista completed");
    assert.ok(!coordList.items.some((item) => item.id === techDraftId), "coordinación no ve borradores");
    assert.equal((await request(`/api/inspections/${foreignDraftId}`, {}, coord)).status, 404, "coordinación no abre borradores");
    const coordMutation = await mutation("PUT", "/api/inspections/eeeeeeee-eeee-4eee-8eee-eeeeeeeeee99", coord, { clientId, kind: "inspection.create", entityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee99", payload: {} }, op(20));
    assert.equal(coordMutation.status, 403, "coordinación no escribe inspecciones");

    console.log("inspection-api.spec.ts: PASS");
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((done) => setTimeout(done, 5000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
    backend.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
