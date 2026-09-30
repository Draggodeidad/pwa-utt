const { createServer } = require("node:http");
const technicianId = "11111111-1111-4111-8111-111111111111";
const coordinatorId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const ownId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreignId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const unknownId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const laboratoryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const accounts = {
  "tech@example.invalid": { id: technicianId, role: "technician", name: "Técnica de prueba" },
  "coord@example.invalid": { id: coordinatorId, role: "coordinator", name: "Coordinación de prueba" },
};
const rows = [
  { id: ownId, folio_number: 101, laboratory_id: laboratoryId, inspector_id: technicianId, inspection_date: "2026-09-20", summary: "Revisión propia autorizada", workflow_status: "draft", deleted_at: null },
  { id: foreignId, folio_number: 102, laboratory_id: laboratoryId, inspector_id: otherId, inspection_date: "2026-09-21", summary: "Registro ajeno confidencial", workflow_status: "completed", deleted_at: null },
];
const findings = [
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", inspection_id: ownId, title: "Cableado expuesto", description: "Cable de prueba", priority: "medium", status: "pending", deleted_at: null },
];
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
function filterIds(items, url, key) {
  const filter = url.searchParams.get(key);
  if (!filter) return items;
  if (filter.startsWith("eq.")) return items.filter((item) => item[key] === filter.slice(3));
  if (filter.startsWith("in.(")) return items.filter((item) => filter.slice(4, -1).split(",").includes(item[key]));
  return items;
}
const backend = createServer(async (req, res) => {
  const url = new URL(req.url, "http://mock.invalid");
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
    let body = ""; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    const account = accounts[input.email];
    if (!account || input.password !== "synthetic-password") return send(res, 400, { code: "invalid_credentials", msg: "Invalid login credentials" });
    const expires_at = Math.floor(Date.now() / 1000) + 3600;
    return send(res, 200, { access_token: token(account.id), refresh_token: `refresh-${account.id}`, token_type: "bearer", expires_in: 3600, expires_at, user: user(account, input.email) });
  }
  if (url.pathname === "/auth/v1/user") {
    const entry = bearerAccount(req);
    return entry ? send(res, 200, user(entry[1], entry[0])) : send(res, 401, { msg: "Invalid JWT" });
  }
  const entry = bearerAccount(req);
  if (!entry) return send(res, 401, { code: "PGRST301", message: "JWT invalid" });
  const account = entry[1];
  if (url.pathname === "/rest/v1/profiles") {
    const profiles = [
      ...Object.values(accounts).map(({ id, role, name }) => ({ id, role, display_name: name, active: true })),
      { id: otherId, role: "technician", display_name: "Otra persona", active: true },
    ];
    const visible = account.role === "coordinator" ? profiles : profiles.filter((profile) => profile.id === account.id);
    return send(res, 200, filterIds(visible, url, "id"));
  }
  if (url.pathname === "/rest/v1/laboratories") return send(res, 200, filterIds([{ id: laboratoryId, code: "LAB-01", name: "Laboratorio de prueba" }], url, "id"));
  const visibleRows = rows.filter((row) => row.inspector_id === account.id || (account.role === "coordinator" && row.workflow_status === "completed"));
  if (url.pathname === "/rest/v1/inspections") return send(res, 200, filterIds(visibleRows, url, "id"));
  if (url.pathname === "/rest/v1/findings") {
    const visibleFindings = findings.filter((finding) => visibleRows.some((row) => row.id === finding.inspection_id));
    return send(res, 200, filterIds(visibleFindings, url, "inspection_id"));
  }
  return send(res, 404, { message: "Not found" });
});

module.exports = { backend, ownId, foreignId, unknownId };
