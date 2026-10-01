const http = require("node:http");

const upstreamPort = Number(process.argv[2]);
const listenPort = Number(process.argv[3]);
if (!Number.isInteger(upstreamPort) || !Number.isInteger(listenPort)) {
  throw new Error("Usage: node tests/helpers/security-browser-proxy.cjs <app port> <proxy port>");
}

const diagnostics = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Phase 26 browser storage</title>
<pre id="result">Checking browser storage...</pre><script>
(async () => {
  const cacheNames = await caches.keys();
  const entries = [];
  const privateCachePaths = [];
  const privateCacheBodies = [];
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const url = new URL(request.url);
      entries.push({ cache: name, path: url.pathname });
      if (/^\\/(?:api|inspections|findings|sync|profile|dashboard)(?:\\/|$)/.test(url.pathname)) {
        privateCachePaths.push(url.pathname);
      }
      const response = await cache.match(request);
      if (response && /phase26 (?:HTTP )?[AB]|[\\w.+-]+@example\\.com/i.test(await response.text())) {
        privateCacheBodies.push(url.pathname);
      }
    }
  }
  const databaseNames = (await indexedDB.databases()).map(database => database.name).filter(Boolean);
  const credentialStores = [];
  for (const name of databaseNames) {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const storeName of database.objectStoreNames) {
      const records = await new Promise((resolve, reject) => {
        const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (/access.token|refresh.token|password|eyJ[A-Za-z0-9_-]{40,}\\./i.test(JSON.stringify(records))) {
        credentialStores.push(name + "/" + storeName);
      }
    }
    database.close();
  }
  const credentialLocalKeys = Object.keys(localStorage).filter(key =>
    /access.token|refresh.token|password|eyJ[A-Za-z0-9_-]{40,}\\./i.test(key + " " + localStorage.getItem(key)));
  document.getElementById("result").textContent = JSON.stringify({
    controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    cacheNames, entries, privateCachePaths, privateCacheBodies,
    databaseNames, credentialStores, credentialLocalKeys,
  }, null, 2);
})().catch(error => { document.getElementById("result").textContent = "ERROR: " + error.message; });
</script></html>`;

http.createServer((request, response) => {
  if (request.url === "/__phase26/inspect") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(diagnostics);
    return;
  }
  const headers = { ...request.headers };
  const dropAck = headers["x-phase26-drop-ack"] === "1";
  const delay = Math.min(Number(headers["x-phase26-delay-ms"] ?? 0), 5000);
  delete headers["x-phase26-drop-ack"];
  delete headers["x-phase26-delay-ms"];
  const upstream = http.request({
    hostname: "127.0.0.1", port: upstreamPort, path: request.url, method: request.method,
    headers,
  }, (remote) => {
    if (dropAck) {
      remote.resume();
      remote.on("end", () => response.destroy());
      return;
    }
    const deliver = () => {
      response.writeHead(remote.statusCode, remote.headers);
      remote.pipe(response);
    };
    if (delay > 0) setTimeout(deliver, delay);
    else deliver();
  });
  upstream.on("error", (error) => {
    response.writeHead(502, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
    response.end(`Upstream unavailable: ${error.code}`);
  });
  request.pipe(upstream);
}).listen(listenPort, "127.0.0.1", () => {
  console.log(`Phase 26 browser proxy ready on 127.0.0.1:${listenPort}`);
});
