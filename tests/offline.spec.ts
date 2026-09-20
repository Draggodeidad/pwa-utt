// tests/offline.spec.ts
// Pruebas unitarias de comportamiento offline y estrategias de cache para public/sw.js

require.extensions[".ts"] = require.extensions[".js"];

const assert = require("node:assert/strict");
const { createSWHarness, MockRequest, MockResponse } = require("./helpers/sw-harness.ts");

async function runOfflineTests() {
  console.log("Iniciando pruebas de estrategias offline y cache (tests/offline.spec.ts)...\n");

  // a) Navegación online: mode 'navigate', networkFirst guarda en NAVIGATION_CACHE
  await (async function testOnlineNavigation() {
    console.log("  [a] Navegación online: almacena en NAVIGATION_CACHE");
    const harness = createSWHarness();
    const navUrl = "https://example.com/inspecciones/1";

    harness.setFetchHandler(async (req) => {
      return new MockResponse("<html><body>Página de inspección #1</body></html>", {
        status: 200,
        headers: { "Cache-Control": "public, max-age=3600" }
      });
    });

    const request = new MockRequest(navUrl, { mode: "navigate" });
    const { handled, response } = await harness.triggerFetch(request);

    assert.equal(handled, true, "La navegación debe ser interceptada");
    assert.equal(response.status, 200, "Debe retornar respuesta exitosa 200");
    assert.equal(response.body, "<html><body>Página de inspección #1</body></html>");

    // Verificar que se guardó en NAVIGATION_CACHE
    const navCache = await harness.caches.open(harness.constants.NAVIGATION_CACHE);
    const cached = await navCache.match(navUrl);
    assert.ok(cached, "La respuesta de navegación debe guardarse en NAVIGATION_CACHE");
    assert.equal(cached.body, "<html><body>Página de inspección #1</body></html>");
  })();

  // b) Navegación offline con cache previa: falla de red retorna la versión cacheada
  await (async function testOfflineNavigationCached() {
    console.log("  [b] Navegación offline: recupera respuesta previa desde NAVIGATION_CACHE");
    const harness = createSWHarness();
    const navUrl = "https://example.com/inspecciones/2";

    const navCache = await harness.caches.open(harness.constants.NAVIGATION_CACHE);
    await navCache.put(
      new MockRequest(navUrl, { mode: "navigate" }),
      new MockResponse("<html>Cached #2</html>", { status: 200 })
    );

    // Simular que la red está offline
    harness.setFetchHandler(async () => {
      throw new TypeError("Failed to fetch");
    });

    const request = new MockRequest(navUrl, { mode: "navigate" });
    const { handled, response } = await harness.triggerFetch(request);

    assert.equal(handled, true, "Debe ser interceptado");
    assert.ok(response, "Debe entregar respuesta sin lanzar excepción");
    assert.equal(response.status, 200);
    assert.equal(response.body, "<html>Cached #2</html>");
  })();

  // c) Navegación offline a ruta desconocida: fallback a app shell ('/')
  await (async function testOfflineNavigationFallbackToShell() {
    console.log("  [c] Navegación offline a ruta desconocida: fallback a app shell ('/') o Response.error()");
    const harness = createSWHarness();

    // 1. Caso con '/' pre-cacheado en APP_SHELL_CACHE
    const shellCache = await harness.caches.open(harness.constants.APP_SHELL_CACHE);
    await shellCache.put(
      new MockRequest("https://example.com/"),
      new MockResponse("<html>App Shell Fallback</html>", { status: 200 })
    );

    harness.setFetchHandler(async () => {
      throw new TypeError("Failed to fetch");
    });

    const unknownRequest = new MockRequest("https://example.com/ruta-nunca-visitada", { mode: "navigate" });
    const resultWithShell = await harness.triggerFetch(unknownRequest);

    assert.equal(resultWithShell.handled, true);
    assert.equal(resultWithShell.response.status, 200);
    assert.equal(resultWithShell.response.body, "<html>App Shell Fallback</html>");

    // 2. Caso sin nada en cache: debe retornar Response.error()
    const harnessEmpty = createSWHarness();
    harnessEmpty.setFetchHandler(async () => {
      throw new TypeError("Failed to fetch");
    });

    const resultWithoutShell = await harnessEmpty.triggerFetch(
      new MockRequest("https://example.com/ruta-sin-cache", { mode: "navigate" })
    );
    assert.equal(resultWithoutShell.handled, true);
    assert.ok(
      resultWithoutShell.response.status === 0 || resultWithoutShell.response.type === "error" || resultWithoutShell.response.isErrorResponse,
      "Si no hay fallback ni red, debe entregar Response.error()"
    );
  })();

  // d) Recurso estático (cache-first hit): sirve desde STATIC_ASSET_CACHE sin tocar la red
  await (async function testStaticAssetCacheHit() {
    console.log("  [d] Recurso estático (cache hit): sirve desde caché sin ir a la red");
    const harness = createSWHarness();
    const assetUrl = "https://example.com/_next/static/chunks/main.js";

    const staticCache = await harness.caches.open(harness.constants.STATIC_ASSET_CACHE);
    await staticCache.put(
      new MockRequest(assetUrl, { destination: "script" }),
      new MockResponse("console.log('from static cache');", { status: 200 })
    );

    // Resetear contador de red
    harness.networkCalls.length = 0;

    const request = new MockRequest(assetUrl, { destination: "script" });
    const { handled, response } = await harness.triggerFetch(request);

    assert.equal(handled, true, "El recurso estático debe ser interceptado");
    assert.equal(response.body, "console.log('from static cache');");
    assert.equal(harness.networkCalls.length, 0, "No debe realizar ninguna llamada de red en un cache hit");
  })();

  // e) Recurso estático (cache-first miss): busca en red, cachea y aplica trimCache si excede MAX_STATIC_ASSETS
  await (async function testStaticAssetCacheMissAndTrim() {
    console.log("  [e] Recurso estático (cache miss): descarga de red y poda FIFO (trimCache)");
    const harness = createSWHarness();
    const staticCache = await harness.caches.open(harness.constants.STATIC_ASSET_CACHE);

    // Llenar STATIC_ASSET_CACHE con 50 elementos existentes
    const maxEntries = harness.constants.MAX_STATIC_ASSETS; // 50
    for (let i = 1; i <= maxEntries; i++) {
      const url = `https://example.com/_next/static/item-${i}.js`;
      await staticCache.put(
        new MockRequest(url, { destination: "script" }),
        new MockResponse(`// content ${i}`, { status: 200, headers: { "Cache-Control": "public, max-age=86400" } })
      );
    }

    const initialKeys = await staticCache.keys();
    assert.equal(initialKeys.length, maxEntries, `Debe haber ${maxEntries} ítems en cache inicialmente`);

    // Interceptar nuevo recurso estático #51
    const newAssetUrl = "https://example.com/_next/static/item-51.js";
    harness.setFetchHandler(async (req) => {
      return new MockResponse("// content 51", {
        status: 200,
        headers: { "Cache-Control": "public, max-age=86400" }
      });
    });

    const request = new MockRequest(newAssetUrl, { destination: "script" });
    const { handled, response } = await harness.triggerFetch(request);

    assert.equal(handled, true);
    assert.equal(response.body, "// content 51");

    // Verificar que tras trimCache, el tamaño no exceda el límite máximo de 50
    const finalKeys = await staticCache.keys();
    assert.equal(finalKeys.length, maxEntries, `La cache debe mantenerse en ${maxEntries} ítems tras la inserción y poda`);

    // El elemento más viejo (item-1.js) debió haber sido eliminado
    const oldestItem = await staticCache.match("https://example.com/_next/static/item-1.js");
    assert.equal(oldestItem, undefined, "El recurso más antiguo (item-1.js) debe ser purgado por trimCache (FIFO)");

    // El nuevo elemento debe estar presente
    const newItem = await staticCache.match(newAssetUrl);
    assert.ok(newItem, "El nuevo recurso #51 debe permanecer en STATIC_ASSET_CACHE");
  })();

  // f) Recurso no cacheado + falla de red
  await (async function testStaticAssetNetworkFailure() {
    console.log("  [f] Recurso estático no cacheado con falla de red: propaga fallo o error controlado");
    const harness = createSWHarness();

    harness.setFetchHandler(async () => {
      throw new TypeError("Failed to fetch");
    });

    const request = new MockRequest("https://example.com/_next/static/missing.css", { destination: "style" });

    // En public/sw.js, cacheFirstStaticAsset no envuelve el fetch en try/catch, por lo que la promesa rechaza
    // con el TypeError de red. Verificamos este comportamiento de diseño documentado.
    await assert.rejects(
      async () => {
        await harness.triggerFetch(request);
      },
      {
        name: "TypeError",
        message: "Failed to fetch"
      },
      "Cuando no hay caché y la red falla en assets estáticos, el SW propaga el fallo de red"
    );
  })();

  console.log("\nTodas las pruebas de tests/offline.spec.ts pasaron exitosamente.\n");
}

runOfflineTests().catch((err) => {
  console.error("Error en tests/offline.spec.ts:\n", err);
  process.exit(1);
});
