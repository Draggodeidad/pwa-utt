// Owner minimum W09 contract. #95 can extend the real cases without a new runner.
const assert = require("node:assert/strict");
const { readFileSync, existsSync, readdirSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createServer } = require("node:net");
const { once } = require("node:events");
const { getSupabaseServerConfig, SupabaseConfigurationError } = require("../src/lib/security/config.ts");
const { validateDomainOperation, validateOperationId } = require("../src/lib/security/validation.ts");
const { validateInspectionForFinalization } = require("../src/features/inspections/schemas/inspection.schema.ts");
const { validateFindingForFinalization } = require("../src/features/findings/schemas/finding.schema.ts");
const root = resolve(__dirname, "..");
const sentinel = "w09_synthetic_redaction_sentinel";
const publicKey = "sb_publishable_w09_synthetic_fixture";
const env = { SUPABASE_URL: "https://project.example.invalid", SUPABASE_ANON_KEY: publicKey };
const uuid = "11111111-1111-4111-8111-111111111111";
let passed = 0, failed = 0;
let browserStage = "launch";
async function check(id, testCase) {
  try { await testCase(); passed++; console.log(`[ok] ${id}`); }
  catch { failed++; console.error(`[fail] ${id} (detalles omitidos para no serializar entradas)`); if (id.startsWith("W09-C2")) console.error(`W09-C2 etapa: ${browserStage}`); }
}
function rejectConfig(overrides) {
  assert.throws(() => getSupabaseServerConfig({ ...env, ...overrides }), error =>
    error instanceof SupabaseConfigurationError && !error.message.includes(sentinel));
}
function legacyKey(role) {
  return [Buffer.from('{"alg":"HS256"}').toString("base64url"), Buffer.from(JSON.stringify({ role })).toString("base64url"), "synthetic_signature"].join(".");
}
async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port; await new Promise(done => server.close(done)); return port;
}
const wait = ms => new Promise(done => setTimeout(done, ms));
async function startApp(overrides) {
  assert.ok(existsSync(join(root, ".next/BUILD_ID")), "Requires make verify production build");
  const base = `http://127.0.0.1:${await freePort()}`;
  const child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", new URL(base).port], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...overrides, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
  async function stop() {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), wait(3000)]);
      if (child.exitCode === null) { child.kill("SIGKILL"); await once(child, "exit"); }
    }
  }
  const request = (path, options = {}) => fetch(base + path, { ...options, redirect: "manual", signal: AbortSignal.timeout(10000) });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) break;
      try { if ((await request("/login")).ok) { ready = true; break; } } catch {}
      await wait(100);
    }
    assert.ok(ready, "Production server must start");
    return { base, request, stop, output: () => output };
  } catch (error) { await stop(); throw error; }
}
async function main() {
  const { getSecurityHeaders } = await import("../src/lib/security/headers.mjs");
  await check("W09-V1/V2 límites canónicos, Unicode, allowlists y versiones", () => {
    const canonical = require("../src/features/sync/types.ts");
    assert.equal(validateDomainOperation, canonical.validateDomainOperation);
    assert.equal(validateOperationId, canonical.validateOperationId);
    const op = { clientId: uuid, entityId: uuid, kind: "inspection.create", payload: {} };
    assert.equal(validateDomainOperation(op).baseVersion, null);
    for (const [kind, field, max] of [["inspection.create", "summary", 3000], ["finding.create", "title", 160], ["finding.create", "description", 3000]]) {
      const input = value => ({ ...op, kind, payload: { ...(kind === "finding.create" ? { inspectionId: uuid } : {}), [field]: value } });
      for (const text of ["x".repeat(max), "😀".repeat(max / 2)]) assert.equal(validateDomainOperation(input(text)).payload[field], text);
      for (const text of ["x".repeat(max + 1), "😀".repeat(max / 2 + 1)]) assert.throws(() => validateDomainOperation(input(text)));
    }
    for (const extra of [{ role: "coordinator" }, { ownerUserId: uuid }]) {
      assert.throws(() => validateDomainOperation({ ...op, ...extra }));
      assert.throws(() => validateDomainOperation({ ...op, payload: extra }));
    }
    assert.throws(() => validateDomainOperation({ ...op, kind: "inspection.update", baseVersion: 0 }));
    assert.throws(() => validateOperationId("invalid"));
    const final = { laboratoryId: uuid, inspectionDate: "2026-10-26", summary: "x".repeat(3000) };
    assert.equal(validateInspectionForFinalization(final).summary.length, 3000);
    assert.throws(() => validateInspectionForFinalization({ ...final, summary: "x".repeat(3001) }));
    assert.equal(validateFindingForFinalization({ title: "x".repeat(160), description: "x".repeat(3000) }).title.length, 160);
    assert.throws(() => validateFindingForFinalization({ title: "x".repeat(161) }));
    assert.throws(() => validateFindingForFinalization({ title: "x", description: "x".repeat(3001) }));
  });
  await check("W09-S1 config cerrada, fronteras, formatos y redacción", () => {
    assert.equal(getSupabaseServerConfig({ ...env, SUPABASE_URL: " https://project.example.invalid/ ", SUPABASE_ANON_KEY: ` ${publicKey} ` }).url, env.SUPABASE_URL);
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) assert.equal(getSupabaseServerConfig({ ...env, SUPABASE_URL: `http://${host}:54321` }).url, `http://${host}:54321`);
    assert.equal(getSupabaseServerConfig({ ...env, SUPABASE_URL: "https://example.invalid:443/" }).url, "https://example.invalid");
    // Extend valid hostname labels to exactly 2048; no DNS call.
    const labels = Array(31).fill("x".repeat(63)).join(".");
    const url2048 = "https://" + labels + "." + "y".repeat(2048 - 9 - labels.length);
    assert.equal(url2048.length, 2048);
    assert.equal(getSupabaseServerConfig({ ...env, SUPABASE_URL: url2048 }).url, url2048);
    rejectConfig({ SUPABASE_URL: url2048 + "z" });
    for (const url of ["", " ", "https://", "//example.invalid", "ftp://example.invalid", "http://example.invalid", "http://127.1", "http://2130706433", "http://0x7f000001", "http://localhost.", "http://sub.localhost", `https://${sentinel}@example.invalid`, "https://example.invalid/path", `https://example.invalid?${sentinel}`, "https://example.invalid/#x", "https://exa mple.invalid", "https://example.invalid\\evil", "https://example.invalid/../", "https://example.invalid\nx"]) rejectConfig({ SUPABASE_URL: url });
    const key4096 = "sb_publishable_" + "x".repeat(4096 - 15);
    assert.equal(key4096.length, 4096);
    assert.equal(getSupabaseServerConfig({ ...env, SUPABASE_ANON_KEY: key4096 }).anonKey.length, 4096);
    assert.equal(getSupabaseServerConfig({ ...env, SUPABASE_ANON_KEY: legacyKey("anon") }).anonKey, legacyKey("anon"));
    for (const key of ["", " ", sentinel, `sb_secret_${sentinel}`, legacyKey("service_role"), legacyKey("authenticated"), `${publicKey} x`, `${publicKey}é`, key4096 + "x", "e30.W10.sig", "e30.eyJyb2xlIjoiYW5vbiJ9."]) rejectConfig({ SUPABASE_ANON_KEY: key });
    assert.throws(() => getSupabaseServerConfig({}), SupabaseConfigurationError);
  });
  await check("W09-C1 política exacta, dev separado", () => {
    const headers = Object.fromEntries(getSecurityHeaders({ production: true }).map(({ key, value }) => [key, value]));
    const csp = headers["Content-Security-Policy"];
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Referrer-Policy"], "no-referrer");
    const policy = Object.fromEntries(csp.split("; ").map(part => { const [key, ...values] = part.split(" "); return [key, values]; }));
    assert.deepEqual(policy, {
      "default-src": ["'self'"], "base-uri": ["'self'"], "object-src": ["'none'"], "frame-ancestors": ["'none'"], "frame-src": ["'none'"], "form-action": ["'self'"], "connect-src": ["'self'"], "script-src": ["'self'", "'unsafe-inline'"], "style-src": ["'self'", "'unsafe-inline'"], "img-src": ["'self'", "data:", "blob:"], "font-src": ["'self'"], "worker-src": ["'self'"], "manifest-src": ["'self'"],
    });
    const dev = getSecurityHeaders({ production: false })[0].value;
    assert.match(dev, /'unsafe-eval'/); assert.match(dev, /ws: wss:/);
    assert.equal(dev.replace(" ws: wss:", "").replace(" 'unsafe-eval'", ""), csp);
  });
  await check("W09-S2/S3 fallo HTTP 503 sin configuración/centinela en logs o cliente", async () => {
    for (const config of [{ SUPABASE_URL: "", SUPABASE_ANON_KEY: "" }, { ...env, SUPABASE_ANON_KEY: `sb_secret_${sentinel}` }]) {
      const app = await startApp(config);
      try {
        for (const path of ["/api/session", "/api/inspections", "/api/laboratories", "/profile"]) {
          const response = await app.request(path);
          assert.equal(response.status, 503);
          assert.equal(response.headers.get("cache-control"), "private, no-store");
          assert.deepEqual(await response.json(), { code: "UNAVAILABLE", error: "Servicio no disponible" });
        }
        const login = await app.request("/api/auth/login", { method: "POST", headers: { Origin: app.base, "Content-Type": "application/json" }, body: JSON.stringify({ email: "tech@example.invalid", password: sentinel }) });
        assert.equal(login.status, 503); assert.ok(!(await login.text()).includes(sentinel));
      } finally { await app.stop(); }
      assert.ok(!app.output().includes(sentinel));
    }
    function inspect(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) inspect(path);
        else if (/\.(js|map)$/.test(path)) {
          const text = readFileSync(path, "utf8");
          for (const value of [sentinel, publicKey, "SUPABASE_ANON_KEY", "sb_secret_"]) assert.ok(!text.includes(value));
        }
      }
    }
    inspect(join(root, ".next/static"));
  });
  await check("W09-S3 reporter conserva fallos, omisiones y SHA sin serializar outputs", () => {
    const result = spawnSync(process.execPath, ["tests/verify-w09.spec.mjs"], { cwd: root, encoding: "utf8", timeout: 60000 });
    assert.equal(result.status, 0); assert.ok(!result.error);
    assert.ok(!(result.stdout + result.stderr).includes(sentinel));
  });
  const { server: backend } = require("./e2e/fixtures/backend.cjs");
  backend.listen(0, "127.0.0.1"); await once(backend, "listening");
  let app;
  try {
    app = await startApp({ SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`, SUPABASE_ANON_KEY: publicKey });
    const expectedHeaders = getSecurityHeaders({ production: true });
    const headersMatch = response => { for (const { key, value } of expectedHeaders) assert.equal(response.headers.get(key), value); };
    await check("W09-C1/C3/R2 headers HTTP públicos, redirect y denegación API independientes de robots", async () => {
      for (const path of ["/login", "/offline", "/profile", "/api/inspections"]) headersMatch(await app.request(path));
      for (const path of ["/profile", "/robots", "/robots.txt/privado", "/robots.txt-extra"]) {
        const response = await app.request(path, { headers: { "User-Agent": "synthetic-bot" } });
        assert.equal(response.status, 307); assert.ok(response.headers.get("location").endsWith("/login"));
      }
      assert.equal((await app.request("/api/inspections")).status, 401);
    });
    await check("W09-V3 MIME/origen/tamaño con efectos HTTP reales", async () => {
      const credentials = JSON.stringify({ email: "tech@example.invalid", password: "synthetic-password" });
      const login = (body, headers = {}) => app.request("/api/auth/login", { method: "POST", headers: { Origin: app.base, "Content-Type": "application/json", ...headers }, body });
      assert.equal((await login(credentials, { "Content-Type": "application/json-extra" })).status, 422);
      assert.equal((await login("{")).status, 422);
      for (const origin of ["", "https://example.invalid", app.base.replace("http:", "https:"), "http://127.0.0.1:1"]) assert.equal((await login(credentials, { Origin: origin })).status, 403);
      assert.equal((await login(credentials + " ".repeat(4096 - credentials.length), { "Content-Type": "Application/JSON; charset=utf-8" })).status, 200);
      assert.equal((await login(credentials + " ".repeat(4097 - credentials.length))).status, 422);
    });
    await check("W09-R1/R3 archivo reservado #99, público aun con bloqueo local", async () => {
      const text = "User-agent: *\nDisallow: /\n";
      assert.equal(readFileSync(join(root, "public/robots.txt"), "utf8"), text);
      for (const headers of [{}, { Cookie: "pwa-utt-logout-blocked=1" }]) {
        const response = await app.request("/robots.txt", { headers }); headersMatch(response);
        assert.equal(response.status, 200); assert.match(response.headers.get("content-type"), /^text\/plain(?:;|$)/);
        assert.equal(await response.text(), text); assert.equal(response.headers.get("location"), null);
      }
    });
    await check("W09-C2 Chromium hidrata, edita, abre diálogo/foto Blob y funciona offline", async () => {
      const { chromium } = require("@playwright/test");
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext({ serviceWorkers: "allow" });
        const page = await context.newPage();
        const violations = [], pageErrors = [];
        await page.addInitScript(() => {
          window.__w09Csp = [];
          document.addEventListener("securitypolicyviolation", event => window.__w09Csp.push(event.effectiveDirective));
        });
        page.on("pageerror", () => pageErrors.push("pageerror"));
        page.on("console", message => { if (/Content Security Policy|hydration/i.test(message.text()) && message.type() === "error") violations.push("browser-error"); });
        const { expect } = require("@playwright/test");
        browserStage = "login";
        await page.goto(app.base + "/login");
        await page.getByLabel("Correo").fill("tech@example.invalid");
        await page.getByRole("textbox", { name: "Contraseña" }).fill("synthetic-password");
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await expect(page.getByRole("heading", { name: /Buen día/ })).toBeVisible({ timeout: 15000 });
        browserStage = "new-inspection";
        await page.getByRole("main").getByRole("link", { name: "Nueva inspección" }).click();
        await expect(page.getByRole("heading", { name: "Nueva inspección" })).toBeVisible();
        await page.getByRole("combobox").selectOption("LAB-E2E");
        await page.getByLabel("Fecha").fill("2026-10-26");
        const inert = '<img src=x onerror="window.__w09Injected=true">';
        await page.getByLabel("Resumen").fill(inert);
        browserStage = "finding-dialog";
        await page.getByRole("button", { name: "Agregar hallazgo" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Título").fill("Hallazgo sintético W09");
        await dialog.getByLabel("Descripción").fill("Diagrama sin personas");
        browserStage = "add-photo";
        await page.getByLabel("Seleccionar foto del hallazgo").setInputFiles(join(root, "public/inspection-assets/finding-evidence.png"));
        browserStage = "photo-preview";
        await page.getByRole("button", { name: /Abrir foto 1 de 1/ }).click();
        await expect(page.getByRole("dialog").getByRole("heading", { name: "Foto 1 de 1" })).toBeVisible();
        assert.ok(await page.getByRole("dialog").locator("img").evaluate(img => img.complete && img.naturalWidth > 0 && img.src.startsWith("blob:")));
        await page.keyboard.press("Escape");
        await dialog.getByRole("button", { name: "Guardar hallazgo" }).click();
        await expect(page.getByRole("heading", { name: "Hallazgo sintético W09" })).toBeVisible();
        browserStage = "service-worker";
        await expect.poll(() => page.evaluate(async () => {
          if (!navigator.serviceWorker.controller) return false;
          const names = await caches.keys();
          for (const name of names.filter(n => n.startsWith("inspecciones-shell-"))) if (await (await caches.open(name)).match("/offline")) return true;
          return false;
        }), { timeout: 15000 }).toBe(true);
        assert.equal(await page.evaluate(() => window.__w09Injected), undefined);
        violations.push(...await page.evaluate(() => window.__w09Csp));
        browserStage = "offline";
        await context.setOffline(true);
        await page.goto(app.base + "/inspections"); await page.reload();
        await expect(page.getByRole("heading", { name: "Inspecciones locales" })).toBeVisible();
        assert.equal(await page.evaluate(() => window.__w09Injected), undefined);
        violations.push(...await page.evaluate(() => window.__w09Csp));
        browserStage = "assert-csp";
        assert.deepEqual(violations, []); assert.deepEqual(pageErrors, []);
        await context.close();
      } finally { await browser.close(); }
    });
    assert.ok(!app.output().includes(sentinel));
  } finally { if (app) await app.stop(); await new Promise(done => backend.close(done)); }
  await check("W09-P4 activos sintéticos sin EXIF/XMP/ICC/IPTC", async () => {
    const sharp = require("sharp");
    for (const file of ["laboratory-evidence-1.jpeg", "laboratory-evidence-2.jpeg", "finding-evidence.png"]) {
      const meta = await sharp(join(root, "public/inspection-assets", file)).metadata();
      assert.equal(meta.width, 640); assert.equal(meta.height, 360);
      for (const key of ["exif", "xmp", "icc", "iptc"]) assert.equal(meta[key], undefined);
    }
  });
  for (const file of ["auth", "inspection-api", "finding-api", "service-worker", "session-isolation", "photo-validation", "inspection-location", "inspection-coordination"]) {
    await check(`W09 regresión ${file} (backend sintético; no acredita RLS remota)`, () => {
      const result = spawnSync(process.execPath, [`tests/${file}.spec.ts`], { cwd: root, env: { ...process.env, AUTH_TEST_PRODUCTION: "1" }, encoding: "utf8", timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
      // Do not forward child diagnostics/payloads into CI artifacts.
      assert.equal(result.status, 0); assert.ok(!result.error);
      assert.ok(!(result.stdout + result.stderr).includes(sentinel));
    });
  }
}
main().catch(() => { failed++; console.error("[fail] W09 no pudo completar la suite"); }).finally(() => {
  console.log(`W09: ${passed} casos pasaron; ${failed} fallaron. Cobertura owner mínima; #95 amplía la matriz.`);
  process.exitCode = passed > 0 && failed === 0 ? 0 : 1;
});
