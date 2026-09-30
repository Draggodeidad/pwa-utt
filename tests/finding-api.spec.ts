// HTTP contract tests for the finding API against a local Supabase
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
const foreignFindingId = "c0c0c0c0-0c0c-4c0c-8c0c-0c0c0c0c0c0c";
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
  { id: findingId, client_id: clientId, inspection_id: techCompletedId, title: "Cableado expuesto", description: "Cable de prueba", priority: "medium", status: "pending", version: 1, created_by: technicianId, updated_by: technicianId, created_at: "2026-09-19T11:00:00Z", updated_at: "2026-09-19T11:00:00Z", resolved_at: null, deleted_at: null },
  { id: foreignFindingId, client_id: clientId, inspection_id: foreignCompletedId, title: "Fuga ajena", description: "", priority: "high", status: "resolved", version: 1, created_by: otherId, updated_by: coordinatorId, created_at: "2026-09-17T11:00:00Z", updated_at: "2026-09-18T12:00:00Z", resolved_at: "2026-09-18T12:00:00Z", deleted_at: null },
];
const receipts = new Map();

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
function visibleFindings(actorId) {
  const role = accountById(actorId)?.role;
  return findings.filter((finding) => finding.deleted_at === null && inspections.some((inspection) =>
    inspection.id === finding.inspection_id && inspection.deleted_at === null &&
    (role === "coordinator" ? inspection.workflow_status === "completed" : inspection.inspector_id === actorId)
  ));
}
function queryFindings(url) {
  const params = url.searchParams;
  let rows = visibleFindings(queryFindings.actor);
  rows = filterById(rows, params.get("id"), "id");
  if (params.get("deleted_at") === "is.null") rows = rows.filter((row) => row.deleted_at === null);
  const inspection = params.get("inspection_id");
  if (inspection?.startsWith("eq.")) rows = rows.filter((row) => row.inspection_id === inspection.slice(3));
  const priority = params.get("priority");
  if (priority?.startsWith("eq.")) rows = rows.filter((row) => row.priority === priority.slice(3));
  const status = params.get("status");
  if (status?.startsWith("eq.")) rows = rows.filter((row) => row.status === status.slice(3));
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
function applyFindingKind(actor, role, op) {
  const { kind, entityId, baseVersion, payload } = op;
  if (kind === "finding.create") {
    if (role !== "technician" || baseVersion !== null) raise("FORBIDDEN_OR_INVALID_INPUT");
    for (const key of Object.keys(payload || {})) if (!["inspectionId", "title", "description", "priority"].includes(key)) raise("FORBIDDEN_OR_INVALID_INPUT");
    const parent = inspections.find((inspection) => inspection.id === payload.inspectionId);
    if (!parent || parent.inspector_id !== actor || parent.workflow_status !== "draft" || parent.deleted_at !== null) raise("NOT_EDITABLE");
    const row = {
      id: entityId, client_id: payload.clientId ?? null, inspection_id: parent.id,
      title: payload.title ?? "", description: payload.description ?? "",
      priority: payload.priority ?? "medium", status: "pending", version: 1,
      created_by: actor, updated_by: actor, created_at: nowIso(), updated_at: nowIso(),
      resolved_at: null, deleted_at: null,
    };
    findings.push(row);
    return row;
  }
  const row = findings.find((finding) => finding.id === entityId);
  if (!row || row.deleted_at !== null) raise("NOT_FOUND");
  const parent = inspections.find((inspection) => inspection.id === row.inspection_id);
  if (!parent || parent.deleted_at !== null) raise("NOT_FOUND");
  if (baseVersion !== row.version) raise("VERSION_CONFLICT");
  if (kind === "finding.followup") {
    if (role !== "coordinator" || parent.workflow_status !== "completed" ||
        Object.keys(payload || {}).some((key) => !["priority", "status"].includes(key))) raise("FORBIDDEN_OR_INVALID_INPUT");
    if (payload.status && payload.status !== row.status &&
        !((row.status === "pending" && payload.status === "in_review") || (row.status === "in_review" && payload.status === "resolved"))) raise("INVALID_TRANSITION");
    if ("priority" in payload) row.priority = payload.priority;
    if ("status" in payload) { row.status = payload.status; if (payload.status === "resolved") row.resolved_at = nowIso(); }
    row.version += 1; row.updated_at = nowIso(); row.updated_by = actor;
    return row;
  }
  if (role !== "technician" || parent.inspector_id !== actor || parent.workflow_status !== "draft") raise("NOT_EDITABLE");
  if (kind === "finding.delete") {
    if (Object.keys(payload || {}).length) raise("INVALID_INPUT");
    row.deleted_at = nowIso(); row.version += 1; row.updated_at = nowIso(); row.updated_by = actor;
    return row;
  }
  if (kind === "finding.update") {
    for (const key of Object.keys(payload || {})) if (!["title", "description", "priority"].includes(key)) raise("INVALID_INPUT");
    if ("title" in payload) row.title = payload.title ?? "";
    if ("description" in payload) row.description = payload.description ?? "";
    if ("priority" in payload) row.priority = payload.priority;
    row.version += 1; row.updated_at = nowIso(); row.updated_by = actor;
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
  if (url.pathname === "/rest/v1/inspections") {
    queryInspections.actor = account.id;
    return send(res, 200, queryInspections(url));
  }
  if (url.pathname === "/rest/v1/findings") {
    queryFindings.actor = account.id;
    return send(res, 200, queryFindings(url));
  }
  if (url.pathname === "/rest/v1/rpc/apply_operation") {
    let body = ""; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body || "{}");
    const { p_operation_id, p_client_id, p_kind, p_entity_id, p_base_version, p_payload } = input;
    const requestKey = `${account.id}:${p_operation_id}`;
    const normalized = { kind: p_kind, entityId: p_entity_id, clientId: p_client_id, baseVersion: p_base_version, payload: p_payload ?? {} };
    const existing = receipts.get(requestKey);
    if (existing) {
      if (JSON.stringify(existing.request) !== JSON.stringify(normalized)) return send(res, 400, { code: "P0001", message: "IDEMPOTENCY_KEY_REUSED" });
      return send(res, 200, { ...existing.result, __replayed: true });
    }
    let result;
    try { result = applyFindingKind(account.id, account.role, normalized); }
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

    assert.equal((await request("/api/findings")).status, 401);
    assert.equal((await request(`/api/findings/${findingId}`)).status, 401);

    const tech = new Map();
    assert.equal((await login("tech@example.invalid", tech)).status, 200);

    const initialList = await (await request("/api/findings", {}, tech)).json();
    assert.ok(initialList.items.some((item) => item.id === findingId), "técnico ve hallazgos de sus inspecciones");
    assert.ok(!initialList.items.some((item) => item.id === foreignFindingId), "no filtra hallazgos ajenos");

    const detail = await (await request(`/api/findings/${findingId}`, {}, tech)).json();
    assert.equal(detail.id, findingId);
    assert.equal(detail.inspectionId, techCompletedId, "el detalle conserva la FK de la inspección");
    assert.equal(detail.folio, "INS-102", "el detalle expone el folio del origen");
    assert.equal(detail.location, "Laboratorio 01", "el detalle expone el laboratorio del origen");
    assert.equal(detail.date, "2026-09-19", "el detalle expone la fecha del origen");
    assert.equal(detail.technician, "Técnica de prueba", "el detalle expone el responsable del origen");
    assert.equal(detail.workflowStatus, "completed");
    assert.equal(detail.priority, "medium");
    assert.equal(detail.status, "pending");
    assert.equal(detail.version, 1);
    assert.equal(detail.resolvedAt, null);

    assert.equal((await request(`/api/findings/${foreignFindingId}`, {}, tech)).status, 404, "hallazgo ajeno no se revela al técnico");

    const newFindingId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";
    const createBody = { clientId, kind: "finding.create", entityId: newFindingId, payload: { inspectionId: techDraftId, title: "Nuevo hallazgo", description: "Detalle", priority: "high" } };
    const created = await mutation("PUT", `/api/findings/${newFindingId}`, tech, createBody, op(1));
    assert.equal(created.status, 201, "PUT válido devuelve 201");
    const createdAck = await created.json();
    assert.equal(createdAck.operationId, op(1));
    assert.equal(createdAck.entityId, newFindingId);
    assert.equal(createdAck.version, 1);
    assert.equal(createdAck.entityType, "finding");
    assert.equal(createdAck.replayed, false);

    const createdDetail = await (await request(`/api/findings/${newFindingId}`, {}, tech)).json();
    assert.equal(createdDetail.id, newFindingId, "GET tras la petición recupera el mismo UUID");
    assert.equal(createdDetail.inspectionId, techDraftId, "la FK apunta al borrador indicado");
    assert.equal(createdDetail.title, "Nuevo hallazgo");
    assert.equal(createdDetail.priority, "high");

    const beforeReplay = (await (await request(`/api/findings?inspectionId=${techDraftId}`, {}, tech)).json()).items.length;
    const replayed = await mutation("PUT", `/api/findings/${newFindingId}`, tech, createBody, op(1));
    assert.equal(replayed.status, 200, "misma key+payload devuelve ACK anterior");
    const replayedAck = await replayed.json();
    assert.equal(replayedAck.version, 1, "el replay no re-aplica la creación");
    assert.equal(replayedAck.replayed, true);
    const afterReplay = (await (await request(`/api/findings?inspectionId=${techDraftId}`, {}, tech)).json()).items.length;
    assert.equal(afterReplay, beforeReplay, "el doble envío no duplica");

    const reused = await mutation("PUT", `/api/findings/${newFindingId}`, tech, { ...createBody, payload: { ...createBody.payload, title: "Contenido distinto" } }, op(1));
    assert.equal(reused.status, 409, "misma key con distinto contenido es 409");
    assert.equal((await reused.json()).code, "IDEMPOTENCY_KEY_REUSED");

    const patched = await mutation("PATCH", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.update", entityId: newFindingId, baseVersion: 1, payload: { description: "Detalle editado" } }, op(2));
    assert.equal(patched.status, 201, "PATCH válido incrementa versión");
    assert.equal((await patched.json()).version, 2);

    const stale = await mutation("PATCH", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.update", entityId: newFindingId, baseVersion: 1, payload: { description: "Versión obsoleta" } }, op(3));
    assert.equal(stale.status, 409, "PATCH con versión vieja es 409");
    assert.equal((await stale.json()).code, "VERSION_CONFLICT");

    assert.equal((await mutation("PUT", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.create", entityId: newFindingId, payload: { inspectionId: foreignDraftId, title: "Intrusión" } }, op(4))).status, 404, "crear en inspección ajena es 404");
    assert.equal((await mutation("PATCH", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.update", entityId: newFindingId, baseVersion: 2, payload: { inspectionId: foreignDraftId } }, op(5))).status, 422, "cambiar la FK del hallazgo es 422");
    assert.equal((await mutation("PATCH", `/api/findings/${findingId}`, tech, { clientId, kind: "finding.update", entityId: findingId, baseVersion: 1, payload: { title: "Tarde" } }, op(6))).status, 404, "editar hallazgo con padre completado es 404");
    assert.equal((await mutation("DELETE", `/api/findings/${findingId}`, tech, { clientId, kind: "finding.delete", entityId: findingId, baseVersion: 1, payload: {} }, op(7))).status, 404, "borrar hallazgo con padre completado es 404");

    const invalidKind = await mutation("PUT", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.update", entityId: newFindingId, payload: { title: "Mal kind" } }, op(8));
    assert.equal(invalidKind.status, 422, "kind incorrecto para el endpoint es 422");
    assert.equal((await invalidKind.json()).code, "VALIDATION_ERROR");
    assert.equal((await mutation("PUT", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.create", entityId: newFindingId, payload: { inspectionId: techDraftId } })).status, 422, "Idempotency-Key ausente es 422");
    assert.equal((await mutation("PUT", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.create", entityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee99", payload: { inspectionId: techDraftId, title: "Otro id" } }, op(9))).status, 422, "entityId distinto al path es 422");

    const discarded = await mutation("DELETE", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.delete", entityId: newFindingId, baseVersion: 2, payload: {} }, op(10));
    assert.equal(discarded.status, 201);
    const discardedAck = await discarded.json();
    assert.equal(discardedAck.version, 3);
    assert.equal((await request(`/api/findings/${newFindingId}`, {}, tech)).status, 404, "el borrado elimina el hallazgo");

    const deleteRetry = await mutation("DELETE", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.delete", entityId: newFindingId, baseVersion: 2, payload: {} }, op(10));
    assert.equal(deleteRetry.status, 200, "el retry devuelve el ACK anterior");
    assert.equal((await deleteRetry.json()).version, 3);
    assert.equal((await request(`/api/findings/${newFindingId}`, {}, tech)).status, 404, "el retry no resucita la entidad");

    const deleteFresh = await mutation("DELETE", `/api/findings/${newFindingId}`, tech, { clientId, kind: "finding.delete", entityId: newFindingId, baseVersion: 2, payload: {} }, op(11));
    assert.equal(deleteFresh.status, 404, "borrado nuevo sobre hallazgo borrado es 404");
    assert.equal((await request(`/api/findings/${newFindingId}`, {}, tech)).status, 404, "no hay resurrección");

    for (let i = 1; i <= 3; i++) {
      await mutation("PUT", `/api/findings/eeeeeeee-eeee-4eee-8eee-eeeeeeeeee2${i}`, tech, { clientId, kind: "finding.create", entityId: `eeeeeeee-eeee-4eee-8eee-eeeeeeeeee2${i}`, payload: { inspectionId: techDraftId, title: `Paginación ${i}` } }, op(20 + i));
    }
    const collected = [];
    let cursor = null;
    let pages = 0;
    do {
      const pageUrl = `/api/findings?inspectionId=${techDraftId}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const page = await (await request(pageUrl, {}, tech)).json();
      assert.ok(page.items.length <= 2, "página acotada");
      collected.push(...page.items);
      cursor = page.nextCursor;
      pages++;
      assert.ok(pages <= 5, "paginación termina en páginas acotadas");
    } while (cursor);
    assert.equal(collected.length, 3, "los hallazgos del borrador se recorren por cursor");
    assert.equal(new Set(collected.map((item) => item.id)).size, collected.length, "sin duplicados entre páginas");

    const invalidParams = await request("/api/findings?limit=abc", {}, tech);
    assert.equal(invalidParams.status, 422);
    assert.equal((await request("/api/findings?priority=urgent", {}, tech)).status, 422);
    assert.equal((await request("/api/findings?status=done", {}, tech)).status, 422);
    assert.equal((await request("/api/findings?inspectionId=not-a-uuid", {}, tech)).status, 422);
    assert.equal((await request("/api/findings?cursor=not-a-cursor", {}, tech)).status, 422);

    const techFollowup = await mutation("PATCH", `/api/findings/${findingId}/follow-up`, tech, { clientId, kind: "finding.followup", entityId: findingId, baseVersion: 1, payload: { status: "in_review" } }, op(30));
    assert.equal(techFollowup.status, 403, "el técnico no hace seguimiento");

    const coord = new Map();
    assert.equal((await login("coord@example.invalid", coord)).status, 200);

    const coordList = await (await request("/api/findings", {}, coord)).json();
    assert.ok(coordList.items.some((item) => item.id === findingId), "coordinación ve hallazgos de completadas propias");
    assert.ok(coordList.items.some((item) => item.id === foreignFindingId), "coordinación ve hallazgos de completadas ajenas");
    assert.ok(!coordList.items.some((item) => item.inspectionId === techDraftId), "coordinación no ve hallazgos de borradores");

    const byInspection = await (await request(`/api/findings?inspectionId=${techCompletedId}`, {}, coord)).json();
    assert.ok(byInspection.items.length === 1 && byInspection.items[0].id === findingId, "filtro por inspección");
    const byPriority = await (await request("/api/findings?priority=high", {}, coord)).json();
    assert.ok(byPriority.items.every((item) => item.priority === "high"), "filtro por prioridad");
    const byStatus = await (await request("/api/findings?status=resolved", {}, coord)).json();
    assert.ok(byStatus.items.length === 1 && byStatus.items[0].id === foreignFindingId, "filtro por estado");

    const followed = await mutation("PATCH", `/api/findings/${findingId}/follow-up`, coord, { clientId, kind: "finding.followup", entityId: findingId, baseVersion: 1, payload: { status: "in_review", priority: "high" } }, op(31));
    assert.equal(followed.status, 201, "follow-up de coordinación incrementa versión");
    assert.equal((await followed.json()).version, 2);
    const followedDetail = await (await request(`/api/findings/${findingId}`, {}, coord)).json();
    assert.equal(followedDetail.status, "in_review", "el seguimiento actualiza el estado");
    assert.equal(followedDetail.priority, "high", "el seguimiento actualiza la prioridad");

    const badTransition = await mutation("PATCH", `/api/findings/${foreignFindingId}/follow-up`, coord, { clientId, kind: "finding.followup", entityId: foreignFindingId, baseVersion: 1, payload: { status: "pending" } }, op(32));
    assert.equal(badTransition.status, 422, "transición inválida (resolved→pending) es 422");
    assert.equal((await badTransition.json()).code, "VALIDATION_ERROR");

    const staleFollowup = await mutation("PATCH", `/api/findings/${findingId}/follow-up`, coord, { clientId, kind: "finding.followup", entityId: findingId, baseVersion: 1, payload: { priority: "low" } }, op(33));
    assert.equal(staleFollowup.status, 409, "follow-up con versión vieja es 409");
    assert.equal((await staleFollowup.json()).code, "VERSION_CONFLICT");

    assert.equal((await mutation("PATCH", `/api/findings/${findingId}/follow-up`, coord, { clientId, kind: "finding.followup", entityId: findingId, baseVersion: 2, payload: { title: "No captura" } }, op(34))).status, 422, "follow-up con campos de captura es 422");
    assert.equal((await mutation("PATCH", `/api/findings/${findingId}/follow-up`, coord, { clientId, kind: "finding.followup", entityId: findingId, baseVersion: 2, payload: {} }, op(35))).status, 422, "follow-up sin campos es 422");
    assert.equal((await mutation("PATCH", `/api/findings/${findingId}`, coord, { clientId, kind: "finding.update", entityId: findingId, baseVersion: 2, payload: { title: "Coordinación captura" } }, op(36))).status, 403, "coordinación no captura hallazgos");
    assert.equal((await mutation("PUT", `/api/findings/eeeeeeee-eeee-4eee-8eee-eeeeeeeeee99`, coord, { clientId, kind: "finding.create", entityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee99", payload: { inspectionId: techCompletedId, title: "Intrusión" } }, op(37))).status, 403, "coordinación no crea hallazgos");

    console.log("finding-api.spec.ts: PASS");
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((done) => setTimeout(done, 5000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
    backend.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
