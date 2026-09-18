const CACHE_VERSION = "w03-v1";
const APP_SHELL_CACHE = `inspecciones-shell-${CACHE_VERSION}`;
const NAVIGATION_CACHE = `inspecciones-navigation-${CACHE_VERSION}`;
const STATIC_ASSET_CACHE = `inspecciones-static-${CACHE_VERSION}`;
const MAX_NAVIGATION_RESPONSES = 20;
const MAX_STATIC_ASSETS = 50;

// Every resource here is present in public/ and can safely be used offline.
const APP_SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable.svg",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png"
];

const SENSITIVE_PATHS = ["/api", "/api/", "/login", "/sync", "/auth/", "/_next/webpack-hmr"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(APP_SHELL_CACHE).then(cache => cache.addAll(APP_SHELL_URLS)));
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
                ![APP_SHELL_CACHE, NAVIGATION_CACHE, STATIC_ASSET_CACHE].includes(cacheName)
            )
            .map(cacheName => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isSensitiveRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(request, url)) event.respondWith(cacheFirstStaticAsset(request));
});

function isSensitiveRequest(url) {
  return SENSITIVE_PATHS.some(path => url.pathname === path || url.pathname.startsWith(path));
}

function isStaticAsset(request, url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    ["style", "script", "image", "font"].includes(request.destination)
  );
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(NAVIGATION_CACHE);
  const shellCache = await caches.open(APP_SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
      await trimCache(cache, MAX_NAVIGATION_RESPONSES);
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await shellCache.match("/")) || Response.error();
  }
}

async function cacheFirstStaticAsset(request) {
  const cache = await caches.open(STATIC_ASSET_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
    await trimCache(cache, MAX_STATIC_ASSETS);
  }
  return response;
}

function isCacheable(response) {
  const cacheControl = response.headers.get("Cache-Control") || "";
  return response.ok && !cacheControl.includes("no-store") && !cacheControl.includes("private");
}

async function trimCache(cache, maximumEntries) {
  const requests = await cache.keys();
  await Promise.all(requests.slice(0, Math.max(0, requests.length - maximumEntries)).map(request => cache.delete(request)));
}
