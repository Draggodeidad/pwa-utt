const CACHE_VERSION = "phase-17-v2";
const APP_SHELL_CACHE = `inspecciones-shell-${CACHE_VERSION}`;
const STATIC_ASSET_CACHE = `inspecciones-static-${CACHE_VERSION}`;
const MAX_STATIC_ASSETS = 50;

// Only this public page and these public files may be stored during install.
const APP_SHELL_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable.svg",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png"
];

// Build-time manifest of essential JS/CSS for the offline shell. These assets
// are precached into the shell cache and never subject to the runtime trim.
const OFFLINE_ASSETS_MANIFEST = "/offline-assets.json";

const PUBLIC_ASSET_URLS = new Set([...APP_SHELL_URLS.filter(path => path !== "/offline"), OFFLINE_ASSETS_MANIFEST]);
const SENSITIVE_PATHS = ["/api", "/login", "/sync", "/auth", "/_next/webpack-hmr"];

self.addEventListener("install", event => {
  event.waitUntil(precachePublicShell().then(notifyReady));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(
              cacheName =>
                cacheName.startsWith("inspecciones-") &&
                ![APP_SHELL_CACHE, STATIC_ASSET_CACHE].includes(cacheName)
            )
            .map(cacheName => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", async event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "READY_QUERY") {
    const ready = await isOfflineReady();
    if (event.source) event.source.postMessage({ type: "OFFLINE_READY_STATE", ready });
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isSensitiveRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigateWithPublicFallback(request));
    return;
  }

  // RSC, API, and other requests are never stored, regardless of destination.
  if (isPublicStaticAsset(url)) event.respondWith(cacheFirstPublicAsset(request));
});

async function precachePublicShell() {
  const cache = await caches.open(APP_SHELL_CACHE);
  for (const path of APP_SHELL_URLS) {
    const { request, response } = await fetchPrecache(path);
    if (!isCacheable(response, path === "/offline") || (path === "/offline" ? isRscResponse(response) : isHtmlOrRsc(response))) {
      throw precacheError(path, response);
    }
    await putPrecache(cache, request, response, path);
  }

  const { request: manifestRequest, response: manifestResponse } = await fetchPrecache(OFFLINE_ASSETS_MANIFEST);
  if (!isCacheable(manifestResponse) || isHtmlOrRsc(manifestResponse)) {
    throw precacheError(OFFLINE_ASSETS_MANIFEST, manifestResponse);
  }
  let manifest;
  try {
    manifest = await manifestResponse.clone().json();
  } catch {
    throw new Error("Offline asset manifest is not valid JSON");
  }
  if (!Array.isArray(manifest?.assets)) throw new Error(`Invalid ${OFFLINE_ASSETS_MANIFEST}: assets must be an array`);

  for (const path of manifest.assets) {
    if (!isEssentialAssetPath(path)) throw new Error(`Invalid ${OFFLINE_ASSETS_MANIFEST} asset: ${String(path)}`);
    const { request, response } = await fetchPrecache(path);
    if (!isCacheable(response) || isHtmlOrRsc(response)) {
      throw precacheError(path, response);
    }
    await putPrecache(cache, request, response, path);
  }
  await putPrecache(cache, manifestRequest, manifestResponse, OFFLINE_ASSETS_MANIFEST);
}

function notifyReady() {
  return self.clients.matchAll({ type: "window" }).then(clients => {
    clients.forEach(client => client.postMessage({ type: "OFFLINE_READY" }));
  });
}

async function isOfflineReady() {
  try {
    const cache = await caches.open(APP_SHELL_CACHE);
    for (const url of APP_SHELL_URLS) {
      if (!(await cache.match(url))) return false;
    }
    const manifestResponse = await cache.match(OFFLINE_ASSETS_MANIFEST);
    if (!manifestResponse) return false;
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest?.assets)) return false;
    for (const url of manifest.assets) {
      if (!isEssentialAssetPath(url)) return false;
      if (!(await cache.match(url))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isSensitiveRequest(url) {
  return SENSITIVE_PATHS.some(path => url.pathname === path || url.pathname.startsWith(`${path}/`));
}

function isPublicStaticAsset(url) {
  return !url.search && (url.pathname.startsWith("/_next/static/") || PUBLIC_ASSET_URLS.has(url.pathname));
}

async function navigateWithPublicFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const shellCache = await caches.open(APP_SHELL_CACHE);
    return (await shellCache.match("/offline")) || Response.error();
  }
}

async function cacheFirstPublicAsset(request) {
  const url = new URL(request.url);
  const shellCache = await caches.open(APP_SHELL_CACHE);
  const precachedResponse = await shellCache.match(request);
  if (precachedResponse) return precachedResponse;

  const cache = await caches.open(STATIC_ASSET_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (isCacheable(response) && !isHtmlOrRsc(response)) {
    await cache.put(request, response.clone());
    await trimCache(cache, MAX_STATIC_ASSETS);
  }
  return response;
}

function isCacheable(response, allowRscVary = false) {
  const cacheControl = response.headers.get("Cache-Control") || "";
  const vary = response.headers.get("Vary") || "";
  const sensitiveVary = allowRscVary ? /(?:^|,)\s*(?:cookie|authorization)\s*(?:,|$)/i : /(?:^|,)\s*(?:cookie|authorization|rsc)\s*(?:,|$)/i;
  return response.ok && !response.redirected &&
    !/(?:^|,)\s*(?:no-store|private)\b/i.test(cacheControl) &&
    !sensitiveVary.test(vary) &&
    !response.headers.has("Set-Cookie");
}

function isHtmlOrRsc(response) {
  const contentType = response.headers.get("Content-Type") || "";
  return /(?:text\/html|text\/x-component)/i.test(contentType);
}

function isRscResponse(response) {
  const contentType = response.headers.get("Content-Type") || "";
  return /text\/x-component/i.test(contentType);
}

function isEssentialAssetPath(path) {
  if (typeof path !== "string" || !path.startsWith("/_next/static/") || !/\.(?:js|css)$/.test(path)) return false;
  const url = new URL(path, self.location.origin);
  return url.pathname === path && !url.search && !url.hash && !path.split("/").includes("..");
}

async function fetchPrecache(path) {
  const request = new Request(new URL(path, self.location.origin).toString(), { credentials: "omit" });
  try {
    return { request, response: await fetch(request) };
  } catch {
    throw new Error(`Failed to precache ${path}: network error`);
  }
}

async function putPrecache(cache, request, response, path) {
  try {
    await cache.put(request, response);
  } catch {
    throw new Error(`Failed to precache ${path}: Cache Storage error`);
  }
}

function precacheError(path, response) {
  const finalPath = response.url ? new URL(response.url, self.location.origin).pathname : "unknown";
  return new Error(`Failed to precache ${path}: status=${response.status}, redirected=${Boolean(response.redirected)}, url=${finalPath}, content-type=${response.headers.get("Content-Type") || "none"}, cache-control=${response.headers.get("Cache-Control") || "none"}, vary=${response.headers.get("Vary") || "none"}`);
}

async function trimCache(cache, maximumEntries) {
  const requests = await cache.keys();
  await Promise.all(requests.slice(0, Math.max(0, requests.length - maximumEntries)).map(request => cache.delete(request)));
}
