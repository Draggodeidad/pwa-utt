require.extensions[".ts"] = require.extensions[".js"];

const assert = require("node:assert/strict");
const { createSWHarness, MockRequest, MockResponse } = require("./helpers/sw-harness.ts");

async function runTests() {
  const harness = createSWHarness();
  harness.setFetchHandler(async request => new MockResponse(`network: ${request.url}`, {
    headers: { "Cache-Control": "public, max-age=3600" }
  }));
  await harness.triggerInstall();

  const shell = await harness.caches.open(harness.constants.APP_SHELL_CACHE);
  const publicFallback = await shell.match("/offline");
  assert.ok(publicFallback);

  // Ni siquiera una respuesta HTML marcada public puede entrar en Cache Storage.
  for (const url of ["/", "/inspections/1", "/profile", "/dashboard", "/offline"]) {
    const result = await harness.triggerFetch(new MockRequest(url, { mode: "navigate" }));
    assert.equal(result.handled, true);
    assert.equal(result.response.body, `network: https://example.com${url}`);
    assert.equal((await shell.match(url))?.body, url === "/offline" ? publicFallback.body : undefined);
  }
  assert.equal((await harness.caches.keys()).some(name => name.includes("navigation")), false);

  // Las respuestas RSC personalizadas no se interceptan ni se almacenan.
  for (const request of [
    new MockRequest("/inspections/1?_rsc=abc", { headers: { RSC: "1" } }),
    new MockRequest("/offline?_rsc=abc", { headers: { RSC: "1" } })
  ]) {
    assert.equal((await harness.triggerFetch(request)).handled, false);
  }

  harness.setFetchHandler(async () => { throw new TypeError("offline"); });
  for (const url of ["/", "/inspections/1", "/profile", "/offline"]) {
    const result = await harness.triggerFetch(new MockRequest(url, { mode: "navigate" }));
    assert.equal(result.handled, true);
    assert.equal(result.response.body, publicFallback.body, `${url} debe mostrar solo el shell público`);
  }
  for (const url of ["/manifest.webmanifest", "/icons/icon.svg", "/apple-touch-icon.png"]) {
    const result = await harness.triggerFetch(new MockRequest(url, { destination: "image" }));
    assert.equal(result.handled, true);
    assert.equal(result.response.body, `network: https://example.com${url}`, `${url} debe salir del precache sin red`);
  }
  const empty = createSWHarness();
  empty.setFetchHandler(async () => { throw new TypeError("offline"); });
  const noFallback = await empty.triggerFetch(new MockRequest("/inspections/1", { mode: "navigate" }));
  assert.equal(noFallback.response.type, "error");

  // Solo los assets de build y las rutas públicas enumeradas usan cache-first.
  const assets = createSWHarness();
  const staticCache = await assets.caches.open(assets.constants.STATIC_ASSET_CACHE);
  const js = new MockRequest("/_next/static/chunks/app.js", { destination: "script" });
  assets.setFetchHandler(async () => new MockResponse("public-js", { headers: { "Cache-Control": "public, max-age=3600" } }));
  assert.equal((await assets.triggerFetch(js)).response.body, "public-js");
  assert.ok(await staticCache.match(js));
  assert.equal((await assets.triggerFetch(new MockRequest("/icons/icon.svg", { destination: "image" }))).handled, true);
  assets.setFetchHandler(async () => { throw new TypeError("offline"); });
  assert.equal((await assets.triggerFetch(js)).response.body, "public-js");

  // Cache-Control y Set-Cookie gobiernan incluso dentro de rutas permitidas.
  for (const [index, headers] of [
    { "Cache-Control": "public, NO-STORE" },
    { "Cache-Control": "max-age=60, PRIVATE" },
    { "Set-Cookie": "session=secret", "Cache-Control": "public" },
    { "Vary": "Accept-Encoding, Cookie", "Cache-Control": "public" },
    { "Content-Type": "text/html", "Cache-Control": "public" },
    { "Content-Type": "text/x-component", "Cache-Control": "public" }
  ].entries()) {
    const request = new MockRequest(`/_next/static/chunks/blocked-${index}.js`, { destination: "script" });
    assets.setFetchHandler(async () => new MockResponse("secret", { headers }));
    assert.equal((await assets.triggerFetch(request)).response.body, "secret");
    assert.equal(await staticCache.match(request), undefined);
  }
  const queriedAsset = new MockRequest("/_next/static/chunks/app.js?user=1", { destination: "script" });
  assert.equal((await assets.triggerFetch(queriedAsset)).handled, false);

  // Los archivos de build siguen disponibles offline y la caché conserva el límite anterior.
  const bounded = createSWHarness();
  const boundedCache = await bounded.caches.open(bounded.constants.STATIC_ASSET_CACHE);
  for (let index = 0; index < bounded.constants.MAX_STATIC_ASSETS; index++) {
    await boundedCache.put(new MockRequest(`/_next/static/chunks/item-${index}.js`), new MockResponse(`item-${index}`));
  }
  bounded.setFetchHandler(async () => new MockResponse("new", { headers: { "Cache-Control": "public" } }));
  await bounded.triggerFetch(new MockRequest("/_next/static/chunks/new.js", { destination: "script" }));
  assert.equal((await boundedCache.keys()).length, bounded.constants.MAX_STATIC_ASSETS);
  assert.equal(await boundedCache.match("/_next/static/chunks/item-0.js"), undefined);
  assert.ok(await boundedCache.match("/_next/static/chunks/new.js"));

  // Una instalación no acepta un shell que el servidor haya marcado privado.
  const privateShell = createSWHarness();
  privateShell.setFetchHandler(async request => new MockResponse(request.url, {
    headers: { "Cache-Control": request.url.endsWith("/offline") ? "private, no-store" : "public" }
  }));
  await assert.rejects(privateShell.triggerInstall(), /not cacheable: \/offline/);
  assert.equal(await (await privateShell.caches.open(privateShell.constants.APP_SHELL_CACHE)).match("/offline"), undefined);

  // Next.js añade Vary: RSC al HTML estático. Solo /offline puede aceptarlo en el precache.
  const nextShell = createSWHarness();
  nextShell.setFetchHandler(async request => new MockResponse(request.url, {
    headers: { "Cache-Control": "public", "Vary": request.url.endsWith("/offline") ? "RSC, Next-Router-State-Tree" : "", "Content-Type": "text/html" }
  }));
  await nextShell.triggerInstall();
  assert.ok(await (await nextShell.caches.open(nextShell.constants.APP_SHELL_CACHE)).match("/offline"));

  const rscShell = createSWHarness();
  rscShell.setFetchHandler(async request => new MockResponse(request.url, {
    headers: { "Cache-Control": "public", "Content-Type": request.url.endsWith("/offline") ? "text/x-component" : "text/html" }
  }));
  await assert.rejects(rscShell.triggerInstall(), /not cacheable: \/offline/);

  // Los assets esenciales del manifest se precachean y no se someten a la poda runtime.
  const essentialAssets = ["/_next/static/chunks/app.js", "/_next/static/css/app.css"];
  const essential = createSWHarness();
  essential.setFetchHandler(async request => new MockResponse(`asset: ${request.url}`, {
    headers: { "Cache-Control": "public, max-age=3600", "Content-Type": "text/javascript" }
  }));
  essential.setOfflineAssets(essentialAssets);
  await essential.triggerInstall();

  const shellCache = await essential.caches.open(essential.constants.APP_SHELL_CACHE);
  for (const url of essentialAssets) assert.ok(await shellCache.match(url), `${url} debe precachearse como esencial`);
  const essentialSet = essential.constants.ESSENTIAL_ASSET_URLS;
  assert.equal(essentialSet.size, essentialAssets.length, "el manifest puebla el conjunto esencial");

  // Un asset esencial se sirve cache-first sin red y no entra en la poda de 50.
  const essentialStaticCache = await essential.caches.open(essential.constants.STATIC_ASSET_CACHE);
  for (let index = 0; index < essential.constants.MAX_STATIC_ASSETS; index++) {
    await essentialStaticCache.put(new MockRequest(`/_next/static/chunks/runtime-${index}.js`), new MockResponse(`runtime-${index}`));
  }
  essential.setFetchHandler(async () => { throw new TypeError("offline"); });
  const essentialFetch = await essential.triggerFetch(new MockRequest(essentialAssets[0], { destination: "script" }));
  assert.equal(essentialFetch.response.body, `asset: https://example.com${essentialAssets[0]}`, "el asset esencial sale del precache sin red");
  assert.equal((await essential.caches.open(essential.constants.APP_SHELL_CACHE)).entries.size, essential.constants.APP_SHELL_URLS.length + essentialAssets.length, "los esenciales sobreviven sin poda");

  // READY_QUERY responde preparación solo cuando shell + esenciales están cacheados.
  const readyReplies = [];
  const readySource = { postMessage: (payload) => readyReplies.push(payload) };
  await essential.triggerMessage({ type: "READY_QUERY" }, readySource);
  assert.equal(readyReplies.length, 1);
  assert.equal(readyReplies[0].type, "OFFLINE_READY_STATE");
  assert.equal(readyReplies[0].ready, true, "con shell y esenciales cacheados el worker se declara listo");

  // Un manifest inválido/ausente hace fallar la instalación (primera visita offline no es "lista").
  const broken = createSWHarness();
  broken.setManifestHandler(() => new MockResponse("no-json", { headers: { "Cache-Control": "public" } }));
  await assert.rejects(broken.triggerInstall(), /manifest is not valid JSON/);

  console.log("offline.spec.ts: PASS");
}

runTests().catch(error => {
  console.error("Fallo en offline.spec.ts:", error);
  process.exitCode = 1;
});
