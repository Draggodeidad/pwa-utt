// Online inspection workflow test: drives the client repositories and the shared
// finalize use case against a local Supabase stand-in through the real Next
// routes, verifying the D5 gate sequence (login -> create -> save -> reload ->
// finding -> finalize) without a browser. No real credentials or project.
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
const foreignCompletedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const clientId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const accounts = {
  "tech@example.invalid": { id: technicianId, role: "technician", name: "Técnica de prueba" },
  "coord@example.invalid": { id: coordinatorId, role: "coordinator", name: "Coordinación de prueba" },
  "other@example.invalid": { id: otherId, role: "technician", name: "Otra persona" },
};
const laboratories = [{ id: laboratoryId, code: "LAB-01", name: "Laboratorio 01", active: true }];
const inspections = [
  { id: techDraftId, folio_number: 101, laboratory_id: laboratoryId, inspector_id: technicianId, inspection_date: "2026-09-20", summary: "Borrador propio", workflow_status: "draft", version: 1, created_at: "2026-09-20T10:00:00Z", updated_at: "2026-09-20T10:00:00Z", completed_at: null, deleted_at: null },
  { id: techCompletedId, folio_number: 102, laboratory_id: laboratoryId, inspector_id: technicianId, inspection_date: "2026-09-19", summary: "Completada propia", workflow_status: "completed", version: 2, created_at: "2026-09-19T10:00:00Z", updated_at: "2026-09-19T11:00:00Z", completed_at: "2026-09-19T11:00:00Z", deleted_at: null },
  { id: foreignCompletedId, folio_number: 104, laboratory_id: laboratoryId, inspector_id: otherId, inspection_date: "2026-09-17", summary: "Completada ajena", workflow_status: "completed", version: 3, created_at: "2026-09-17T10:00:00Z", updated_at: "2026-09-17T11:00:00Z", completed_at: "2026-09-17T11:00:00Z", deleted_at: null },
];
const findings = [
  { id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1", client_id: clientId, inspection_id: techCompletedId, title: "Cableado expuesto", description: "Cable de prueba", priority: "medium", status: "pending", version: 1, created_by: technicianId, updated_by: technicianId, created_at: "2026-09-19T11:00:00Z", updated_at: "2026-09-19T11:00:00Z", resolved_at: null, deleted_at: null },
  { id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2", client_id: clientId, inspection_id: foreignCompletedId, title: "Fuga ajena", description: "", priority: "high", status: "resolved", version: 1, created_by: otherId, updated_by: coordinatorId, created_at: "2026-09-17T11:00:00Z", updated_at: "2026-09-18T12:00:00Z", resolved_at: "2026-09-18T12:00:00Z", deleted_at: null },
];
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
function applyOperationKind(actor, role, op) {
  const { kind, entityId, baseVersion, payload } = op;
  if (kind === "inspection.create") {
    if (role !== "technician" || baseVersion !== null) raise("FORBIDDEN_OR_INVALID_INPUT");
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
  if (kind.startsWith("inspection.")) {
    const row = inspections.find((item) => item.id === entityId);
    if (!row || row.inspector_id !== actor || row.deleted_at !== null) raise("NOT_FOUND");
    if (row.workflow_status !== "draft" || baseVersion !== row.version) raise("VERSION_OR_STATE_CONFLICT");
    if (kind === "inspection.update") {
      if (role !== "technician") raise("FORBIDDEN");
      for (const key of Object.keys(payload || {})) if (!["laboratoryId", "inspectionDate", "summary"].includes(key)) raise("INVALID_INPUT");
      if (payload.laboratoryId != null && !laboratories.some((lab) => lab.id === payload.laboratoryId && lab.active)) raise("INVALID_LABORATORY");
      if ("laboratoryId" in payload) row.laboratory_id = payload.laboratoryId ?? null;
      if ("inspectionDate" in payload) row.inspection_date = payload.inspectionDate ?? null;
      if ("summary" in payload) row.summary = payload.summary ?? "";
      row.version += 1; row.updated_at = nowIso();
      return row;
    }
    if (kind === "inspection.discard") {
      if (role !== "technician" || Object.keys(payload || {}).length) raise("INVALID_INPUT");
      row.deleted_at = nowIso(); row.version += 1; row.updated_at = nowIso();
      return row;
    }
    if (kind === "inspection.finalize") {
      if (role !== "technician" || Object.keys(payload || {}).some((key) => key !== "expectedFindingIds")) raise("INVALID_INPUT");
      if (!Array.isArray(payload?.expectedFindingIds)) raise("INVALID_INPUT");
      const expected = [...payload.expectedFindingIds].map(String).sort();
      const actual = findings.filter((finding) => finding.inspection_id === entityId && finding.deleted_at === null).map((finding) => finding.id).sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) raise("FINDING_SET_CONFLICT");
      if (row.laboratory_id === null || row.inspection_date === null || !String(row.summary).trim() ||
          findings.some((finding) => finding.inspection_id === entityId && finding.deleted_at === null && !String(finding.title).trim())) {
        raise("FINALIZATION_INVALID");
      }
      row.workflow_status = "completed"; row.completed_at = nowIso(); row.version += 1; row.updated_at = nowIso();
      return row;
    }
    raise("INVALID_OPERATION");
  }
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
  if (kind.startsWith("finding.")) {
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
      return send(res, 200, existing.result);
    }
    let result;
    try { result = applyOperationKind(account.id, account.role, normalized); }
    catch (error) { return send(res, 400, { code: "P0001", message: error.message }); }
    receipts.set(requestKey, { request: normalized, result });
    return send(res, 200, result);
  }
  return send(res, 404, { message: "Not found" });
});

function cookieClient(base, jar) {
  const call = async (method, path, options = {}) => {
    const headers = { "Content-Type": "application/json", ...(jar.size ? { Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") } : {}) };
    if (options.operationId) headers["Idempotency-Key"] = options.operationId;
    if (method !== "GET") headers.Origin = base;
    const response = await fetch(base + path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    for (const value of response.headers.getSetCookie()) {
      const first = value.split(";", 1)[0];
      const separator = first.indexOf("=");
      const name = first.slice(0, separator), content = first.slice(separator + 1);
      if (content) jar.set(name, content); else jar.delete(name);
    }
    if (!response.ok) {
      let payload = null;
      try { payload = await response.json(); } catch {}
      const error = new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload ?? { code: "UNAVAILABLE", message: error.message };
      throw error;
    }
    if (response.status === 204) return undefined;
    return response.json();
  };
  return {
    get: (path) => call("GET", path),
    post: (path, body, options) => call("POST", path, { body, operationId: options?.operationId }),
    put: (path, body, options) => call("PUT", path, { body, operationId: options?.operationId }),
    patch: (path, body, options) => call("PATCH", path, { body, operationId: options?.operationId }),
    delete: (path, options) => call("DELETE", path, { body: options?.body, operationId: options?.operationId }),
  };
}

async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port; server.close(); await once(server, "close"); return port;
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

  const { RemoteInspectionRepository } = require("../src/features/inspections/services/remote-inspection.repository.ts");
  const { RemoteFindingRepository } = require("../src/features/findings/services/remote-finding.repository.ts");
  const { finalizeInspection } = require("../src/features/inspections/services/finalize-inspection.ts");

  try {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Next terminated: ${output}`);
      try { const ready = await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) }); if (ready.ok) break; } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }

    const techJar = new Map();
    const login = async (email, jar) => {
      const response = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "synthetic-password" }),
        redirect: "manual",
      });
      for (const value of response.headers.getSetCookie()) {
        const first = value.split(";", 1)[0];
        const separator = first.indexOf("=");
        const name = first.slice(0, separator), content = first.slice(separator + 1);
        if (content) jar.set(name, content); else jar.delete(name);
      }
      assert.equal(response.status, 200, "login técnico");
    };
    await login("tech@example.invalid", techJar);

    const inspectionsRepo = new RemoteInspectionRepository(cookieClient(base, techJar));
    const findingsRepo = new RemoteFindingRepository(cookieClient(base, techJar));

    const initialList = await inspectionsRepo.list();
    assert.ok(initialList.some((item) => item.id === techDraftId), "el técnico ve sus inspecciones");

    const newInspectionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";
    const created = await inspectionsRepo.create(newInspectionId, { laboratoryId, inspectionDate: "2026-09-22", summary: "Revisión nueva" });
    assert.equal(created.entityType, "inspection");
    assert.equal(created.version, 1);
    assert.equal(created.entityId, newInspectionId);

    assert.equal((await inspectionsRepo.getDetail(newInspectionId)).id, newInspectionId, "el detalle recupera la nueva inspección");

    const detail = await inspectionsRepo.getDetail(newInspectionId);
    assert.equal(detail.workflowStatus, "draft");

    const updated = await inspectionsRepo.update(newInspectionId, 1, { summary: "Revisión nueva editada" });
    assert.equal(updated.version, 2, "guardar borrador incrementa versión");

    const findingId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11";
    const findingAck = await findingsRepo.create(findingId, { inspectionId: newInspectionId, title: "Cableado expuesto", description: "Revisión de cableado", priority: "medium" });
    assert.equal(findingAck.entityType, "finding");
    assert.equal(findingAck.version, 1);

    const newFindingId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12";
    const result = await finalizeInspection({
      inspectionId: newInspectionId,
      inspectionVersion: 2,
      inspectionDraft: { summary: "Revisión nueva editada" },
      inspectionDirty: true,
      findings: [
        { id: findingId, version: 1, title: "Cableado expuesto", description: "Revisión de cableado", priority: "medium", status: "pending", pendingUpdate: true },
        { id: newFindingId, version: null, title: "Ventilador ruidoso", description: "Ventilador del equipo 7", priority: "low", status: "pending" },
      ],
      inspectionRepository: inspectionsRepo,
      findingRepository: findingsRepo,
    });
    assert.equal(result.workflowStatus, "completed");
    assert.equal(result.syncStatus, "synced");

    const finalizedDetail = await inspectionsRepo.getDetail(newInspectionId);
    assert.equal(finalizedDetail.workflowStatus, "completed", "la finalización persiste el estado");
    assert.equal(finalizedDetail.scope, "Revisión nueva editada", "la captura guardada en finalize es la vigente");
    assert.equal(finalizedDetail.findings.length, 2, "ambos hallazgos se confirman con ACK");

    await assert.rejects(() => inspectionsRepo.update(newInspectionId, 3, { summary: "Tarde" }), (error) => error.status === 409, "finalizada bloquea captura posterior");
    await assert.rejects(() => findingsRepo.delete(findingId, 2), (error) => error.status === 404, "hallazgo de finalizada no se elimina");

    const coordJar = new Map();
    await login("coord@example.invalid", coordJar);
    const coordRepo = new RemoteInspectionRepository(cookieClient(base, coordJar));
    assert.equal((await coordRepo.getDetail(newInspectionId)).workflowStatus, "completed", "coordinación lee la finalizada por API");

    const discardId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02";
    const discardCreated = await inspectionsRepo.create(discardId, { summary: "Para descartar" });
    const discarded = await inspectionsRepo.discard(discardId, discardCreated.version);
    assert.equal(discarded.version, 2, "el descarte entrega el ACK");
    assert.equal(await inspectionsRepo.getDetail(discardId), null, "el descarte elimina el borrador del listado");
    await assert.rejects(() => inspectionsRepo.discard(discardId, 1), (error) => error.status === 404, "no hay resurrección tras descartar");

    console.log("online-inspection-workflow.spec.ts: PASS");
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((done) => setTimeout(done, 5000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
    backend.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });