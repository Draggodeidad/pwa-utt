// Rendering and route authorization against explicit UUID fixtures in a local Supabase stand-in.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const typescript = require("typescript");

const root = resolve(__dirname, "..");
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const source = readFileSync(filename, "utf8");
    const output = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS, jsx: typescript.JsxEmit.ReactJSX, target: typescript.ScriptTarget.ES2022 } });
    module._compile(output.outputText, filename);
  };
}
const { inspections } = require("../src/features/inspections/data/inspections.ts");
const { filterInspections } = require("../src/features/inspections/hooks/use-inspection-filters.ts");
const { LoadingState } = require("../src/components/loading-state.tsx");

const { backend, ownId, foreignId, unknownId } = require("./helpers/rendering-backend.cjs");
async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port; server.close(); await once(server, "close"); return port;
}
function cookiesFrom(response, jar) {
  for (const value of response.headers.getSetCookie()) {
    const [name, content] = value.split(";", 1)[0].split("=");
    if (content) jar.set(name, content); else jar.delete(name);
  }
}
async function main() {
  const loading = renderToStaticMarkup(createElement(LoadingState));
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(renderToStaticMarkup(createElement(LoadingState, { state: "error" })), /role="alert"/);
  assert.match(renderToStaticMarkup(createElement(LoadingState, { state: "empty", headingLevel: 2 })), /<h2/);
  assert.equal(filterInspections(inspections, "cómputo a", "all", "all").length, 1);
  assert.equal(filterInspections(inspections, "sin coincidencia", "all", "all").length, 0);

  backend.listen(0, "127.0.0.1"); await once(backend, "listening");
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`, SUPABASE_ANON_KEY: "synthetic-anon-key" },
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-4000); });
  child.stderr.on("data", (chunk) => { output = `${output}${chunk}`.slice(-4000); });
  const request = async (path, jar, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (jar?.size) headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(base + path, { ...options, headers, redirect: "manual", signal: AbortSignal.timeout(15000) });
    if (jar) cookiesFrom(response, jar);
    return { response, body: await response.text() };
  };
  try {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Next terminated: ${output}`);
      try { if ((await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) })).ok) break; } catch {}
      await new Promise((done) => setTimeout(done, 250));
    }
    assert.equal((await request("/inspecciones")).response.status, 307);
    const anonymousListApi = await request("/api/inspections");
    assert.equal(anonymousListApi.response.status, 401);
    const anonymousApi = await request(`/api/inspections/${ownId}`);
    assert.equal(anonymousApi.response.status, 401);
    assert.equal(JSON.parse(anonymousApi.body).code, "UNAUTHENTICATED");
    const rejectedOrigin = await request("/api/auth/login", undefined, {
      method: "POST", headers: { Origin: "https://foreign.invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tech@example.invalid", password: "synthetic-password" }),
    });
    assert.equal(rejectedOrigin.response.status, 403);
    assert.equal(JSON.parse(rejectedOrigin.body).code, "FORBIDDEN");
    const login = async (email) => {
      const jar = new Map();
      const { response } = await request("/api/auth/login", jar, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "synthetic-password" }) });
      assert.equal(response.status, 200);
      return jar;
    };
    const tech = await login("tech@example.invalid");
    const list = await request("/inspecciones", tech);
    assert.equal(list.response.status, 200, output);
    assert.match(list.body, /Cargando inspecciones/);
    assert.match(list.body, /aria-busy="true"/);
    assert.doesNotMatch(list.body, /Revisión propia autorizada/);
    assert.doesNotMatch(list.body, /Registro ajeno confidencial/);
    const listApi = await request("/api/inspections", tech);
    assert.equal(listApi.response.status, 200);
    assert.equal(listApi.response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(JSON.parse(listApi.body).items.map((item) => item.id), [ownId]);
    const listError = await request("/inspecciones?estado=error", tech);
    assert.equal(listError.response.status, 200);
    assert.match(listError.body, /No fue posible cargar la información/);
    const listEmpty = await request("/inspecciones?estado=vacio", tech);
    assert.match(listEmpty.body, /No hay inspecciones para mostrar/);
    const detail = await request(`/inspecciones/${ownId}`, tech);
    assert.equal(detail.response.status, 200, output);
    assert.match(detail.body, /Laboratorio de prueba/);
    assert.match(detail.body, /Cableado expuesto/);
    const apiDetail = await request(`/api/inspections/${ownId}`, tech);
    assert.equal(apiDetail.response.status, 200);
    assert.equal(apiDetail.response.headers.get("cache-control"), "private, no-store");
    assert.equal(JSON.parse(apiDetail.body).id, ownId);
    const operationalDetail = await request(`/inspections/${ownId}`, tech);
    assert.equal(operationalDetail.response.status, 200);
    const editable = await request(`/inspections/${ownId}/edit`, tech);
    assert.equal(editable.response.status, 200);
    for (const id of [foreignId, unknownId, "inspection-001"]) {
      const hidden = await request(`/inspecciones/${id}`, tech);
      assert.equal(hidden.response.status, 404, `${id}: ${output}`);
      assert.doesNotMatch(hidden.body, /Registro ajeno confidencial/);
      const hiddenApi = await request(`/api/inspections/${id}`, tech);
      assert.equal(hiddenApi.response.status, 404);
      assert.equal(JSON.parse(hiddenApi.body).code, "NOT_FOUND");
      const hiddenOperational = await request(`/inspections/${id}`, tech);
      assert.equal(hiddenOperational.response.status, 404);
      const hiddenEdit = await request(`/inspections/${id}/edit`, tech);
      assert.equal(hiddenEdit.response.status, 404);
    }
    const detailError = await request(`/inspecciones/${ownId}?estado=error`, tech);
    assert.match(detailError.body, /No fue posible cargar el detalle/);
    const deniedDashboard = await request("/dashboard", tech);
    assert.equal(deniedDashboard.response.status, 307);
    assert.equal(new URL(deniedDashboard.response.headers.get("location")).pathname, "/");
    assert.doesNotMatch(deniedDashboard.body, /Resumen de coordinación/);
    const deniedFindings = await request("/findings", tech);
    assert.equal(deniedFindings.response.status, 307);
    assert.equal(new URL(deniedFindings.response.headers.get("location")).pathname, "/");
    const coordination = await login("coord@example.invalid");
    const coordinatorDetail = await request(`/inspecciones/${foreignId}`, coordination);
    assert.equal(coordinatorDetail.response.status, 200);
    assert.match(coordinatorDetail.body, /Registro ajeno confidencial/);
    const deniedCreation = await request("/inspections/new", coordination);
    assert.equal(deniedCreation.response.status, 307);
    assert.equal(new URL(deniedCreation.response.headers.get("location")).pathname, "/dashboard");
    assert.doesNotMatch(deniedCreation.body, /Crear inspección/);
    const deniedSync = await request("/sync", coordination);
    assert.equal(deniedSync.response.status, 307);
    console.log("rendering.spec.ts: PASS");
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((done) => setTimeout(done, 5000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
    backend.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
