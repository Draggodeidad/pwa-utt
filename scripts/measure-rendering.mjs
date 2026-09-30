import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const { backend, ownId } = require("../tests/helpers/rendering-backend.cjs");
const routes = [
  { name: "list-csr-initial-html", path: "/inspecciones", expected: "Cargando inspecciones" },
  { name: "detail-ssr-html", path: `/inspecciones/${ownId}`, expected: "Laboratorio de prueba" },
];

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function freePort() {
  const server = createServer();
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  const port = server.address().port;
  await new Promise((closed) => server.close(closed));
  return port;
}

async function measure(base, route, cookie) {
  const samples = [];
  for (let index = 0; index < 6; index += 1) {
    const started = performance.now();
    const response = await fetch(`${base}${route.path}`, { cache: "no-store", headers: { Cookie: cookie }, redirect: "manual", signal: AbortSignal.timeout(15000) });
    const firstByteMs = performance.now() - started;
    const body = await response.arrayBuffer();
    const completeMs = performance.now() - started;
    const html = new TextDecoder().decode(body);
    if (response.status !== 200 || !html.includes(route.expected)) throw new Error(`Respuesta inesperada para ${route.path}: ${response.status}`);
    if (index > 0) samples.push({ firstByteMs, completeMs, htmlBytes: body.byteLength });
  }
  return {
    route: route.path,
    samples: samples.length,
    medianFirstByteMs: Number(median(samples.map((sample) => sample.firstByteMs)).toFixed(2)),
    medianCompleteMs: Number(median(samples.map((sample) => sample.completeMs)).toFixed(2)),
    medianHtmlBytes: median(samples.map((sample) => sample.htmlBytes)),
  };
}

backend.listen(0, "127.0.0.1");
await once(backend, "listening");
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`, SUPABASE_ANON_KEY: "synthetic-anon-key" },
});
let output = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { output = `${output}${chunk}`.slice(-8000); });

try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Servidor de producción terminó:\n${output}`);
    try {
      const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Wait until production server starts. */ }
    await new Promise((resume) => setTimeout(resume, 200));
  }
  if (!ready) throw new Error(`Servidor de producción no inició:\n${output}`);

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "tech@example.invalid", password: "synthetic-password" }),
    signal: AbortSignal.timeout(15000),
  });
  if (login.status !== 200) throw new Error(`Login sintético falló: ${login.status}`);
  const cookie = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  if (!cookie) throw new Error("Login sintético no creó cookie");

  const results = [];
  for (const route of routes) results.push({ name: route.name, ...await measure(base, route, cookie) });
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    commitSha: commit.status === 0 ? commit.stdout.trim() : null,
    runtime: { node: process.version, mode: "next start", host: "127.0.0.1" },
    method: "Synthetic authenticated session, one warm-up and five sequential no-store HTTP requests per route; timings use performance.now() on the client process.",
    results,
    limits: "HTTP response timing and HTML size do not measure browser hydration or time until CSR records appear.",
  };
  mkdirSync(resolve(root, "reports"), { recursive: true });
  writeFileSync(resolve(root, "reports/rendering-metrics.json"), `${JSON.stringify(report, null, 2)}\n`);
  for (const result of results) console.log(`${result.name}: median first byte ${result.medianFirstByteMs} ms, complete ${result.medianCompleteMs} ms, HTML ${result.medianHtmlBytes} bytes`);
  console.log("Reporte: reports/rendering-metrics.json");
} finally {
  server.kill("SIGTERM");
  backend.close();
}
