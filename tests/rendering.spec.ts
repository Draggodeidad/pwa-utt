// Behavioral rendering checks for the Week 04 CSR and SSR routes.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { createServer } = require("node:net");
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
const { findInspectionDetail } = require("../src/features/inspections/data/inspection-detail.ts");
const { filterInspections } = require("../src/features/inspections/hooks/use-inspection-filters.ts");
const { LoadingState } = require("../src/components/loading-state.tsx");

async function freePort() {
  const server = createServer();
  await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  const address = server.address();
  await new Promise((resolveClosed) => server.close(resolveClosed));
  return address.port;
}

async function startServer(port) {
  const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-8000); });
  child.stderr.on("data", (chunk) => { output = `${output}${chunk}`.slice(-8000); });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next terminó antes de iniciar:\n${output}`);
    try {
      const response = await fetch(`${base}/inspecciones`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return { child, base };
    } catch { /* Wait for the dev server to become ready. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  child.kill("SIGTERM");
  throw new Error(`Next no inició en 45 segundos:\n${output}`);
}

async function readRoute(base, path) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000) });
  return { status: response.status, html: await response.text() };
}

async function main() {
  const loading = renderToStaticMarkup(createElement(LoadingState));
  const error = renderToStaticMarkup(createElement(LoadingState, { state: "error" }));
  const empty = renderToStaticMarkup(createElement(LoadingState, { state: "empty", headingLevel: 2 }));
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(error, /role="alert"/);
  assert.match(empty, /<h2/);

  assert.equal(filterInspections(inspections, "cómputo a", "all", "all").length, 1);
  assert.equal(filterInspections(inspections, "LAB-COMP-02", "requires_attention", "all")[0]?.id, "inspection-002");
  assert.equal(filterInspections(inspections, "sin coincidencia", "all", "all").length, 0);
  assert.equal(filterInspections(inspections, "", "without_findings", "all").length, 2);
  assert.equal(findInspectionDetail("inspection-inexistente"), undefined);
  for (const item of inspections) {
    const detail = findInspectionDetail(item.id);
    assert.equal(detail?.location, item.location);
    assert.equal(detail?.date, item.date);
    assert.equal(detail?.findings.length, item.findingCount);
  }

  const { child, base } = await startServer(await freePort());
  try {
    const list = await readRoute(base, "/inspecciones");
    assert.equal(list.status, 200);
    assert.match(list.html, /Cargando inspecciones/);
    assert.match(list.html, /aria-busy="true"/);
    assert.match(list.html, /Inspecciones/);

    const listError = await readRoute(base, "/inspecciones?estado=error");
    assert.equal(listError.status, 200);
    assert.match(listError.html, /No fue posible cargar la información/);
    assert.match(listError.html, /Volver a intentar/);

    const listEmpty = await readRoute(base, "/inspecciones?estado=vacio");
    assert.equal(listEmpty.status, 200);
    assert.match(listEmpty.html, /No hay inspecciones para mostrar/);

    const detail = await readRoute(base, "/inspecciones/inspection-001");
    assert.equal(detail.status, 200);
    assert.match(detail.html, /Laboratorio de Cómputo A/);
    assert.match(detail.html, /href="\/inspecciones"/);
    assert.match(detail.html, /No se registraron hallazgos/);

    const detailWithFindings = await readRoute(base, "/inspecciones/inspection-004");
    assert.equal(detailWithFindings.status, 200);
    assert.match(detailWithFindings.html, /Centro de Cómputo General/);
    assert.equal(inspections.find((item) => item.id === "inspection-004")?.findingCount, 2);
    assert.match(detailWithFindings.html, /registrado/);
    assert.match(detailWithFindings.html, /Cableado expuesto/);

    const missing = await readRoute(base, "/inspecciones/inspection-inexistente");
    assert.equal(missing.status, 404);
    assert.match(missing.html, /La página o inspección solicitada no está disponible/);

    const detailError = await readRoute(base, "/inspecciones/inspection-001?estado=error");
    assert.match(detailError.html, /No fue posible cargar el detalle/);
    console.log("rendering.spec.ts: PASS");
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        new Promise((finished) => child.once("exit", finished)),
        new Promise((finished) => setTimeout(finished, 5000)),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
