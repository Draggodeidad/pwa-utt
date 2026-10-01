const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  if (argument === "--network-proxy") return ["networkProxy", true];
  const match = /^--(base|a|b|coord|inactive)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Unknown argument: ${argument}`);
  return [match[1], match[2]];
}));

function readPassword() {
  assert.ok(process.stdin.isTTY, "run from a terminal to enter the shared test password");
  process.stdout.write("Shared synthetic test password: ");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.off("data", receive);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const receive = (bytes) => {
      for (const byte of bytes) {
        if (byte === 13 || byte === 10) { finish(); resolve(value); return; }
        if (byte === 3) { finish(); reject(new Error("Password entry cancelled")); return; }
        if (byte === 127) value = value.slice(0, -1);
        else value += String.fromCharCode(byte);
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", receive);
  });
}

function browserSession() { return { cookies: new Map() }; }

function rememberCookies(session, response) {
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(line)) session.cookies.delete(name);
    else session.cookies.set(name, value);
  }
}

async function request(session, method, path, { body, key, origin = "same", extraHeaders = {} } = {}) {
  const headers = {};
  if (session?.cookies.size) headers.Cookie = [...session.cookies]
    .map(([name, value]) => `${name}=${value}`).join("; ");
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) headers["Idempotency-Key"] = key;
  Object.assign(headers, extraHeaders);
  if (origin !== "none" && method !== "GET") {
    headers.Origin = origin === "same" ? options.base : origin;
  }
  const response = await fetch(new URL(path, options.base), {
    method, headers, redirect: "manual",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (session) rememberCookies(session, response);
  assert.match(response.headers.get("Cache-Control") ?? "", /(?:^|,)\s*private\s*,\s*no-store|no-store/i,
    `${method} ${path}: private no-store required`);
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; }
  catch { throw new Error(`${method} ${path}: expected JSON (HTTP ${response.status})`); }
  return { status: response.status, data, headers: response.headers };
}

function expiredCookieSession(active) {
  const expired = browserSession();
  expired.cookies = new Map(active.cookies);
  const names = [...expired.cookies.keys()];
  const stem = names.find((name) => /-auth-token(?:\.0)?$/.test(name))?.replace(/\.0$/, "");
  assert.ok(stem, "Supabase auth cookie must exist");
  const chunks = names.filter((name) => name === stem || name.startsWith(`${stem}.`));
  const encoded = expired.cookies.get(stem) ?? chunks.sort((left, right) =>
    Number(left.slice(stem.length + 1)) - Number(right.slice(stem.length + 1)))
    .map((name) => expired.cookies.get(name)).join("");
  assert.ok(encoded.startsWith("base64-"), "Supabase SSR cookie format is required");
  const auth = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString("utf8"));
  auth.expires_at = 1;
  auth.expires_in = 1;
  auth.refresh_token = "expired-refresh-token";
  const replacement = `base64-${Buffer.from(JSON.stringify(auth)).toString("base64url")}`;
  for (const name of chunks) expired.cookies.delete(name);
  if (replacement.length < 3100) expired.cookies.set(stem, replacement);
  else for (let index = 0, offset = 0; offset < replacement.length; index++, offset += 3100) {
    expired.cookies.set(`${stem}.${index}`, replacement.slice(offset, offset + 3100));
  }
  return expired;
}

function body(kind, id, clientId, payload, baseVersion) {
  return { clientId, kind, entityId: id,
    ...(baseVersion === undefined ? {} : { baseVersion }), payload };
}

async function mutate(session, method, path, kind, id, clientId, payload, baseVersion, key = randomUUID()) {
  return request(session, method, path, { body: body(kind, id, clientId, payload, baseVersion), key });
}

async function login(email, password, expectedRole) {
  const session = browserSession();
  const result = await request(session, "POST", "/api/auth/login", { body: { email, password } });
  assert.equal(result.status, 200, "valid active account must log in");
  assert.equal(result.data.user.role, expectedRole);
  assert.ok(session.cookies.size, "HTTP login must set private auth cookies");
  return { ...session, id: result.data.user.id };
}

async function main() {
  for (const role of ["base", "a", "b", "coord", "inactive"]) {
    assert.ok(options[role], `--${role}=... is required`);
  }
  const password = await readPassword();
  const anonymous = browserSession();
  assert.equal((await request(anonymous, "GET", "/api/session")).status, 401);
  assert.equal((await request(anonymous, "GET", "/api/inspections")).status, 401);
  assert.equal((await request(anonymous, "GET", "/api/findings")).status, 401);
  const anonymousWrite = await mutate(anonymous, "PUT", `/api/inspections/${randomUUID()}`,
    "inspection.create", randomUUID(), randomUUID(), {}, undefined);
  assert.equal(anonymousWrite.status, 401);
  const inactiveSession = browserSession();
  assert.equal((await request(inactiveSession, "POST", "/api/auth/login",
    { body: { email: options.inactive, password } })).status, 401);
  assert.equal((await request(inactiveSession, "GET", "/api/session")).status, 401);
  console.log("PASS HTTP anonymous and inactive identity denial with no-store");

  const [a, b, coord] = await Promise.all([
    login(options.a, password, "technician"),
    login(options.b, password, "technician"),
    login(options.coord, password, "coordinator"),
  ]);
  assert.equal(new Set([a.id, b.id, coord.id]).size, 3);
  for (const actor of [a, b, coord]) {
    const current = await request(actor, "GET", "/api/session");
    assert.equal(current.status, 200);
    assert.equal(current.data.user.id, actor.id);
  }
  assert.equal((await request(expiredCookieSession(a), "GET", "/api/session")).status, 401,
    "expired session without a valid refresh token must be rejected");
  console.log("PASS HTTP expired cookie session rejected");
  const clientA = randomUUID();
  const clientB = randomUUID();
  const inspectionA = randomUUID();
  const inspectionB = randomUUID();
  const pathA = `/api/inspections/${inspectionA}`;
  const pathB = `/api/inspections/${inspectionB}`;
  const createAKey = randomUUID();
  const createA = await mutate(a, "PUT", pathA, "inspection.create", inspectionA,
    clientA, { summary: "phase26 HTTP A" }, undefined, createAKey);
  assert.equal(createA.status, 201);
  assert.equal(createA.data.replayed, false);
  assert.equal((await mutate(b, "PUT", pathB, "inspection.create", inspectionB,
    clientB, { summary: "phase26 HTTP B" }, undefined)).status, 201);
  assert.equal((await request(a, "GET", pathA)).status, 200);
  assert.equal((await request(b, "GET", pathA)).status, 404);
  assert.equal((await request(a, "GET", pathB)).status, 404);
  assert.equal((await request(coord, "GET", pathA)).status, 404);
  assert.equal((await mutate(coord, "PUT", `/api/inspections/${randomUUID()}`,
    "inspection.create", randomUUID(), randomUUID(), {}, undefined)).status, 403);
  assert.equal((await mutate(b, "PATCH", pathA, "inspection.update", inspectionA,
    clientB, { summary: "B cross edit" }, createA.data.version)).status, 404);
  console.log("PASS HTTP A/B/coordinator reads, writes and 401/403/404 semantics");

  const replay = await mutate(a, "PUT", pathA, "inspection.create", inspectionA,
    clientA, { summary: "phase26 HTTP A" }, undefined, createAKey);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.version, createA.data.version);
  const altered = await mutate(a, "PUT", pathA, "inspection.create", inspectionA,
    clientA, { summary: "changed key payload" }, undefined, createAKey);
  assert.equal(altered.status, 409);
  assert.equal(altered.data.code, "IDEMPOTENCY_KEY_REUSED");
  const duplicate = await mutate(a, "PUT", pathA, "inspection.create", inspectionA,
    clientA, { summary: "duplicate entity id" }, undefined);
  assert.equal(duplicate.status, 409, "reused entity UUID must be a conflict, not 503");
  const invalidField = await mutate(a, "PATCH", pathA, "inspection.update", inspectionA,
    clientA, { inspectorId: b.id }, createA.data.version);
  assert.equal(invalidField.status, 422);
  assert.equal((await request(a, "PUT", `/api/inspections/${randomUUID()}`,
    { body: body("inspection.create", randomUUID(), clientA, {}), key: randomUUID(),
      origin: "https://foreign.example" })).status, 403);
  assert.equal((await request(a, "PUT", `/api/inspections/${randomUUID()}`,
    { body: body("inspection.create", randomUUID(), clientA, {}), key: randomUUID(),
      origin: "none" })).status, 403);
  console.log("PASS HTTP replay, changed key, UUID reuse, fields and CSRF/origin");

  const update = await mutate(a, "PATCH", pathA, "inspection.update", inspectionA,
    clientA, { summary: "phase26 HTTP updated" }, createA.data.version);
  assert.equal(update.status, 201);
  const stale = await mutate(a, "PATCH", pathA, "inspection.update", inspectionA,
    clientA, { summary: "stale" }, createA.data.version);
  assert.equal(stale.status, 409);
  assert.equal(stale.data.code, "VERSION_CONFLICT");
  const findingId = randomUUID();
  const findingPath = `/api/findings/${findingId}`;
  const findingKey = randomUUID();
  const createdFinding = await mutate(a, "PUT", findingPath, "finding.create", findingId,
    clientA, { inspectionId: inspectionA, title: "phase26 HTTP finding", priority: "medium" },
    undefined, findingKey);
  assert.equal(createdFinding.status, 201);
  assert.equal((await request(b, "GET", findingPath)).status, 404);
  assert.equal((await request(coord, "GET", findingPath)).status, 404);
  assert.equal((await mutate(a, "PUT", findingPath, "finding.create", findingId,
    clientA, { inspectionId: inspectionA, title: "phase26 HTTP finding", priority: "medium" },
    undefined, findingKey)).status, 200);
  const duplicateFinding = await mutate(a, "PUT", findingPath, "finding.create", findingId,
    clientA, { inspectionId: inspectionA, title: "duplicate finding" }, undefined);
  assert.equal(duplicateFinding.status, 409, "reused finding UUID must be a conflict, not 503");
  const invalidFollowup = await mutate(coord, "PATCH", `${findingPath}/follow-up`,
    "finding.followup", findingId, randomUUID(), { status: "in_review" }, createdFinding.data.version);
  assert.equal(invalidFollowup.status, 403, "coordination cannot follow up a draft");
  console.log("PASS HTTP inspection/finding versions, reads and UUID reuse");

  const laboratories = await request(a, "GET", "/api/laboratories");
  assert.equal(laboratories.status, 200);
  assert.ok(laboratories.data.length > 0);
  const ready = await mutate(a, "PATCH", pathA, "inspection.update", inspectionA, clientA,
    { laboratoryId: laboratories.data[0].id, inspectionDate: "2026-10-01",
      summary: "phase26 HTTP completed" }, update.data.version);
  assert.equal(ready.status, 201);
  const wrongSet = await mutate(a, "POST", `${pathA}/finalize`, "inspection.finalize",
    inspectionA, clientA, { expectedFindingIds: [] }, ready.data.version);
  assert.equal(wrongSet.status, 409);
  assert.equal(wrongSet.data.code, "FINDING_SET_CONFLICT");
  const completed = await mutate(a, "POST", `${pathA}/finalize`, "inspection.finalize",
    inspectionA, clientA, { expectedFindingIds: [findingId] }, ready.data.version);
  assert.equal(completed.status, 201);
  assert.equal((await request(coord, "GET", pathA)).status, 200);
  assert.equal((await request(coord, "GET", findingPath)).status, 200);
  assert.equal((await mutate(a, "PATCH", findingPath, "finding.update", findingId,
    clientA, { title: "late" }, createdFinding.data.version)).status, 404);
  const followup = await mutate(coord, "PATCH", `${findingPath}/follow-up`,
    "finding.followup", findingId, randomUUID(), { status: "in_review", priority: "high" },
    createdFinding.data.version);
  assert.equal(followup.status, 201);
  assert.equal((await mutate(a, "PATCH", `${findingPath}/follow-up`,
    "finding.followup", findingId, clientA, { status: "resolved" }, followup.data.version)).status, 403);
  console.log("PASS HTTP finalization and coordination field/state permissions");

  if (options.networkProxy) {
    const lostId = randomUUID();
    const lostKey = randomUUID();
    const lostPayload = body("inspection.create", lostId, clientB,
      { summary: "phase26 lost ACK" });
    await assert.rejects(fetch(new URL(`/api/inspections/${lostId}`, options.base), {
      method: "PUT",
      headers: { Origin: options.base, Cookie: [...b.cookies]
        .map(([name, value]) => `${name}=${value}`).join("; "),
      "Content-Type": "application/json", "Idempotency-Key": lostKey,
      "X-Phase26-Drop-Ack": "1" },
      body: JSON.stringify(lostPayload),
    }), "client must lose response after the server commits");
    const recovered = await mutate(b, "PUT", `/api/inspections/${lostId}`,
      "inspection.create", lostId, clientB, lostPayload.payload, undefined, lostKey);
    assert.equal(recovered.status, 200);
    assert.equal(recovered.data.replayed, true);
    assert.equal((await request(b, "GET", `/api/inspections/${lostId}`)).status, 200);

    const late = browserSession();
    late.cookies = new Map(a.cookies);
    const oldResponse = request(late, "GET", pathA,
      { extraHeaders: { "X-Phase26-Delay-Ms": "3000" } });
    const bSwitch = await request(late, "POST", "/api/auth/login",
      { body: { email: options.b, password } });
    assert.equal(bSwitch.status, 200);
    assert.equal(bSwitch.data.user.id, b.id);
    await oldResponse;
    assert.equal((await request(late, "GET", "/api/session")).data.user.id, b.id,
      "late A response must not restore A cookies over B");
    console.log("PASS HTTP lost ACK replay and late A response after account switch");
  }

  const switched = browserSession();
  switched.cookies = new Map(a.cookies);
  const switchedLogin = await request(switched, "POST", "/api/auth/login",
    { body: { email: options.b, password } });
  assert.equal(switchedLogin.status, 200);
  assert.equal((await request(switched, "GET", "/api/session")).data.user.id, b.id);
  assert.equal((await request(switched, "GET", pathA)).status, 404);
  assert.equal((await request(a, "POST", "/api/auth/logout")).status, 204);
  assert.equal((await request(a, "GET", "/api/session")).status, 401);
  assert.equal((await request(b, "GET", "/api/session")).status, 200);
  console.log("PASS HTTP account switch, logout isolation and no-store");
  console.log("security-http.spec.cjs: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
