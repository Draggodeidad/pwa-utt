// tests/service-worker.spec.ts
// Suite de pruebas unitarias y de ciclo de vida para public/sw.js
// Valida listeners, precaching, activacion, skipWaiting y exclusiones de fetch.

require.extensions[".ts"] = require.extensions[".js"];

const assert = require("node:assert/strict");
const { createSWHarness, MockRequest } = require("./helpers/sw-harness.ts");

async function runTests() {
  console.log("Iniciando suite: service-worker.spec.ts...");

  // -------------------------------------------------------------------------
  // Caso a: install registra el listener y precachea exactamente APP_SHELL_URLS en APP_SHELL_CACHE
  // -------------------------------------------------------------------------
  {
    const harness = createSWHarness();
    assert.ok(harness.listeners.install.length > 0, "El evento 'install' debe estar registrado en el service worker");

    await harness.triggerInstall();

    const shellCacheName = harness.constants.APP_SHELL_CACHE;
    assert.equal(shellCacheName, "inspecciones-shell-w03-v1", "El nombre de la caché del app shell debe coincidir con la versión w03-v1");

    const shellCache = await harness.caches.open(shellCacheName);
    const expectedUrls = harness.constants.APP_SHELL_URLS;
    assert.ok(Array.isArray(expectedUrls) && expectedUrls.length > 0, "APP_SHELL_URLS debe contener las URLs precacheadas");

    for (const url of expectedUrls) {
      const match = await shellCache.match(url);
      assert.ok(match, `La URL '${url}' debe estar precacheada en ${shellCacheName}`);
    }

    const cachedKeys = await shellCache.keys();
    assert.equal(
      cachedKeys.length,
      expectedUrls.length,
      `La caché del app shell debe contener exactamente ${expectedUrls.length} recursos precacheados`
    );
  }

  // -------------------------------------------------------------------------
  // Caso b: activate limpia cachés viejas cuyo nombre inicia con "inspecciones-" y llama self.clients.claim()
  // -------------------------------------------------------------------------
  {
    const harness = createSWHarness();
    assert.ok(harness.listeners.activate.length > 0, "El evento 'activate' debe estar registrado");

    // Poblamos cachés obsoletas y una de terceros
    await harness.caches.open("inspecciones-shell-v0");
    await harness.caches.open("inspecciones-navigation-old");
    await harness.caches.open("other-app-cache");

    assert.ok(await harness.caches.has("inspecciones-shell-v0"), "Debe existir la caché antigua previa a la activación");
    assert.ok(await harness.caches.has("inspecciones-navigation-old"), "Debe existir la caché de navegación vieja");
    assert.ok(await harness.caches.has("other-app-cache"), "Debe existir la caché de terceros");

    await harness.triggerActivate();

    assert.equal(
      await harness.caches.has("inspecciones-shell-v0"),
      false,
      "activate debe eliminar 'inspecciones-shell-v0' porque no coincide con la versión actual"
    );
    assert.equal(
      await harness.caches.has("inspecciones-navigation-old"),
      false,
      "activate debe eliminar 'inspecciones-navigation-old'"
    );
    assert.equal(
      await harness.caches.has("other-app-cache"),
      true,
      "activate NO debe eliminar cachés que no comiencen con 'inspecciones-'"
    );
    assert.equal(
      harness.clientsClaimCalled,
      true,
      "activate debe ejecutar self.clients.claim() para tomar control inmediato"
    );
  }

  // -------------------------------------------------------------------------
  // Caso c: activate NO borra las cachés vigentes de la versión actual
  // -------------------------------------------------------------------------
  {
    const harness = createSWHarness();
    const currentShell = harness.constants.APP_SHELL_CACHE;
    const currentNav = harness.constants.NAVIGATION_CACHE;
    const currentStatic = harness.constants.STATIC_ASSET_CACHE;

    await harness.caches.open(currentShell);
    await harness.caches.open(currentNav);
    await harness.caches.open(currentStatic);

    await harness.triggerActivate();

    assert.equal(await harness.caches.has(currentShell), true, "activate NO debe borrar APP_SHELL_CACHE vigente");
    assert.equal(await harness.caches.has(currentNav), true, "activate NO debe borrar NAVIGATION_CACHE vigente");
    assert.equal(await harness.caches.has(currentStatic), true, "activate NO debe borrar STATIC_ASSET_CACHE vigente");
  }

  // -------------------------------------------------------------------------
  // Caso d: message con { type: "SKIP_WAITING" } dispara self.skipWaiting()
  // -------------------------------------------------------------------------
  {
    const harness = createSWHarness();
    assert.ok(harness.listeners.message.length > 0, "El evento 'message' debe estar registrado");

    assert.equal(harness.skipWaitingCalled, false, "skipWaiting no debe ejecutarse antes de recibir el mensaje");

    // Mensaje irrelevante
    harness.triggerMessage({ type: "UNKNOWN_ACTION" });
    assert.equal(harness.skipWaitingCalled, false, "Mensajes desconocidos no deben invocar skipWaiting");

    // Mensaje SKIP_WAITING
    harness.triggerMessage({ type: "SKIP_WAITING" });
    assert.equal(
      harness.skipWaitingCalled,
      true,
      "message con type: 'SKIP_WAITING' debe disparar self.skipWaiting() para la actualización segura"
    );
  }

  // -------------------------------------------------------------------------
  // Caso e: fetch excluye requests con method !== "GET"
  // -------------------------------------------------------------------------
  {
    const harness = createSWHarness();

    const postReq = new MockRequest("/inspections", { method: "POST" });
    const postResult = await harness.triggerFetch(postReq);
    assert.equal(postResult.handled, false, "fetch debe ignorar y dejar pasar requests con método POST");

    const putReq = new MockRequest("/inspections/1", { method: "PUT" });
    const putResult = await harness.triggerFetch(putReq);
    assert.equal(putResult.handled, false, "fetch debe ignorar requests con método PUT");

    const deleteReq = new MockRequest("/inspections/1", { method: "DELETE" });
    const deleteResult = await harness.triggerFetch(deleteReq);
    assert.equal(deleteResult.handled, false, "fetch debe ignorar requests con método DELETE");
  }

  // -------------------------------------------------------------------------
  // Caso f: fetch excluye rutas sensibles: "/api", "/api/", "/login", "/sync", "/auth/", "/_next/webpack-hmr"
  // -------------------------------------------------------------------------
  {
    const harness = createSWHarness();
    const sensitivePaths = harness.constants.SENSITIVE_PATHS;

    assert.ok(Array.isArray(sensitivePaths), "SENSITIVE_PATHS debe estar definido");

    for (const path of sensitivePaths) {
      const req = new MockRequest(path, { method: "GET" });
      const result = await harness.triggerFetch(req);
      assert.equal(result.handled, false, `fetch debe excluir la ruta sensible '${path}' sin interceptarla`);

      const subPathReq = new MockRequest(`${path}/sub-recurso`, { method: "GET" });
      const subResult = await harness.triggerFetch(subPathReq);
      assert.equal(subResult.handled, false, `fetch debe excluir subrutas de la ruta sensible '${path}'`);
    }
  }

  // -------------------------------------------------------------------------
  // Caso g: fetch excluye requests de origen cruzado (url.origin !== self.location.origin)
  // -------------------------------------------------------------------------
  {
    const harness = createSWHarness({ origin: "https://pwa.universidad.edu" });

    const crossOriginReq = new MockRequest("https://cdn.externo.com/script.js", { method: "GET" });
    const result = await harness.triggerFetch(crossOriginReq);

    assert.equal(
      result.handled,
      false,
      "fetch debe ignorar peticiones hacia un origen distinto a self.location.origin"
    );
  }

  console.log("service-worker.spec.ts: PASS");
}

runTests().catch(error => {
  console.error("Fallo en service-worker.spec.ts:", error);
  process.exit(1);
});
