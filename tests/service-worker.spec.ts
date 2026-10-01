require.extensions[".ts"] = require.extensions[".js"];

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSWHarness, MockRequest, MockResponse } = require("./helpers/sw-harness.ts");

async function runTests() {
  const harness = createSWHarness();
  const { APP_SHELL_CACHE, STATIC_ASSET_CACHE, APP_SHELL_URLS } = harness.constants;
  assert.equal(harness.constants.CACHE_VERSION, "phase-25-v1");

  assert.equal(harness.listeners.install.length, 1);
  assert.equal(harness.listeners.activate.length, 1);
  assert.deepEqual(Array.from(APP_SHELL_URLS), [
    "/offline", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png",
    "/icons/icon-512.png", "/icons/icon-maskable.svg", "/icons/icon-maskable-512.png",
    "/apple-touch-icon.png"
  ]);
  assert.ok(!APP_SHELL_URLS.includes("/"), "La página inicial no debe precachearse");

  for (const url of APP_SHELL_URLS.slice(1)) {
    assert.ok(fs.existsSync(path.resolve(__dirname, "../public", url.slice(1))), `${url} debe existir en public/`);
  }
  const offlinePage = fs.readFileSync(path.resolve(__dirname, "../src/app/offline/page.tsx"), "utf8");
  assert.match(offlinePage, /force-static/);
  assert.doesNotMatch(offlinePage, /temporarySession|cookies\(|headers\(|AppShell|inspections|findings|profile/i);

  await harness.triggerInstall();
  const shell = await harness.caches.open(APP_SHELL_CACHE);
  assert.equal((await shell.keys()).length, APP_SHELL_URLS.length + 1);
  for (const url of APP_SHELL_URLS) assert.ok(await shell.match(url), `${url} debe estar precacheado`);
  assert.ok(await shell.match("/offline-assets.json"));
  assert.ok(harness.networkCalls.every(call => call.request.credentials === "omit"), "El precache no debe enviar cookies");
  assert.equal(await shell.match("/"), undefined);

  // Las versiones previas guardaban HTML tanto en shell como en navegación.
  for (const name of ["inspecciones-shell-w03-v1", "inspecciones-navigation-w03-v1", "inspecciones-static-w03-v1", "inspecciones-shell-phase-17-v1", "inspecciones-static-phase-17-v1"]) {
    const oldCache = await harness.caches.open(name);
    await oldCache.put(new MockRequest("/inspections/1", { mode: "navigate" }), new MockResponse("HTML privado"));
  }
  await harness.caches.open(STATIC_ASSET_CACHE);
  await harness.caches.open("other-app-cache");
  await harness.triggerActivate();
  for (const name of ["inspecciones-shell-w03-v1", "inspecciones-navigation-w03-v1", "inspecciones-static-w03-v1", "inspecciones-shell-phase-17-v1", "inspecciones-static-phase-17-v1"]) {
    assert.equal(await harness.caches.has(name), false, `${name} debe eliminarse`);
  }
  assert.equal(await harness.caches.has(APP_SHELL_CACHE), true);
  assert.equal(await harness.caches.has(STATIC_ASSET_CACHE), true);
  assert.equal(await harness.caches.has("other-app-cache"), true);
  assert.equal(harness.clientsClaimCalled, true);

  // El matcher solo deja pasar recursos públicos exactos; las rutas privadas siguen en middleware.
  const middlewareSource = fs.readFileSync(path.resolve(__dirname, "../src/middleware.ts"), "utf8");
  const matcherSource = /matcher:\s*\["([^\"]+)"\]/.exec(middlewareSource)?.[1];
  assert.ok(matcherSource, "el middleware debe declarar un matcher");
  const matcher = new RegExp(`^${JSON.parse(`"${matcherSource}"`)}$`);
  for (const url of ["/offline", "/sw.js", "/manifest.webmanifest", "/offline-assets.json", "/apple-touch-icon.png", "/icons/icon.svg", "/_next/static/chunks/app.js", "/inspection-assets/finding-evidence.png", "/screenshots/mobile-home.png"]) {
    assert.equal(matcher.test(url), false, `${url} debe ser público`);
  }
  for (const url of ["/", "/dashboard", "/profile", "/sync", "/login", "/auth/callback", "/offline-private", "/apple-touch-icon.png/private", "/icons-private/icon.svg"]) {
    assert.equal(matcher.test(url), true, `${url} debe pasar por middleware`);
  }

  await harness.triggerMessage({ type: "OTHER" });
  assert.equal(harness.skipWaitingCalled, false);
  await harness.triggerMessage({ type: "SKIP_WAITING" });
  assert.equal(harness.skipWaitingCalled, false, "la activación antigua no debe saltar la preparación");

  for (const method of ["POST", "PUT", "DELETE"]) {
    assert.equal((await harness.triggerFetch(new MockRequest("/inspections", { method }))).handled, false);
  }
  for (const url of ["/api", "/api/inspections", "/login", "/login/reset", "/sync", "/auth/callback", "/_next/webpack-hmr"]) {
    for (const mode of ["navigate", "cors"]) {
      assert.equal((await harness.triggerFetch(new MockRequest(url, { mode }))).handled, false, `${url} debe pasar de largo`);
    }
  }
  assert.equal((await harness.triggerFetch(new MockRequest("https://external.example/a.js", { destination: "script" }))).handled, false);

  // El tipo de recurso por sí solo no permite cachear una respuesta privada.
  for (const url of ["/inspection-assets/private.png", "/screenshots/private.png", "/profile/photo.png", "/inspections/1", "/?__flight__=1", "/offline?_rsc=secret"]) {
    assert.equal((await harness.triggerFetch(new MockRequest(url, { destination: "image" }))).handled, false, `${url} no es un asset público permitido`);
  }

  console.log("service-worker.spec.ts: PASS");
}

runTests().catch(error => {
  console.error("Fallo en service-worker.spec.ts:", error);
  process.exitCode = 1;
});
