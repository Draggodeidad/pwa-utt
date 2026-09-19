// tests/helpers/sw-harness.ts
// Arnés determinista en memoria para evaluar public/sw.js en Node.js usando node:vm
// No requiere dependencias externas ni navegador real.

require.extensions[".ts"] = require.extensions[".js"];

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function normalizeKey(requestOrUrl) {
  if (!requestOrUrl) return "";
  const raw = typeof requestOrUrl === "string" ? requestOrUrl : (requestOrUrl.url || "");
  try {
    const u = new URL(raw, "https://example.com");
    return u.pathname + u.search;
  } catch {
    return raw;
  }
}

class MockHeaders {
  constructor(init = {}) {
    this._map = new Map();
    if (init) {
      if (typeof init.entries === "function") {
        for (const [k, v] of init.entries()) {
          this._map.set(String(k).toLowerCase(), String(v));
        }
      } else if (Array.isArray(init)) {
        for (const [k, v] of init) {
          this._map.set(String(k).toLowerCase(), String(v));
        }
      } else {
        for (const [k, v] of Object.entries(init)) {
          this._map.set(String(k).toLowerCase(), String(v));
        }
      }
    }
  }

  get(name) {
    return this._map.get(String(name).toLowerCase()) ?? null;
  }

  set(name, value) {
    this._map.set(String(name).toLowerCase(), String(value));
  }

  has(name) {
    return this._map.has(String(name).toLowerCase());
  }

  delete(name) {
    return this._map.delete(String(name).toLowerCase());
  }

  entries() {
    return this._map.entries();
  }
}

class MockResponse {
  constructor(body = null, init = {}) {
    this.body = body;
    this.status = typeof init.status === "number" ? init.status : 200;
    this.statusText = init.statusText || (this.status >= 200 && this.status < 300 ? "OK" : "");
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new MockHeaders(init.headers);
    this.type = init.type || "basic";
    this.isErrorResponse = Boolean(init.isErrorResponse);
  }

  clone() {
    const copy = new MockResponse(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers._map,
      type: this.type,
      isErrorResponse: this.isErrorResponse
    });
    return copy;
  }

  static error() {
    const err = new MockResponse(null, { status: 0, statusText: "" });
    err.ok = false;
    err.type = "error";
    err.isErrorResponse = true;
    return err;
  }
}

class MockRequest {
  constructor(input, init = {}) {
    if (typeof input === "string") {
      this.url = input.startsWith("http") ? input : `https://example.com${input.startsWith("/") ? "" : "/"}${input}`;
    } else if (input && input.url) {
      this.url = input.url;
      this.method = input.method || "GET";
      this.mode = input.mode || "cors";
      this.destination = input.destination || "";
    } else {
      this.url = "https://example.com/";
    }
    if (init.method) this.method = init.method;
    if (!this.method) this.method = "GET";
    this.method = this.method.toUpperCase();

    if (init.mode) this.mode = init.mode;
    if (!this.mode) this.mode = "cors";

    if (init.destination) this.destination = init.destination;
    if (!this.destination) this.destination = "";

    this.headers = new MockHeaders(init.headers);
  }
}

class MockCache {
  constructor(name, harness) {
    this.name = name;
    this.harness = harness;
    this.entries = new Map();
    this.puts = [];
    this.deletes = [];
  }

  async addAll(urls) {
    for (const rawUrl of urls) {
      const req = new MockRequest(rawUrl);
      const res = await this.harness.fetch(req);
      await this.put(req, res);
    }
  }

  async put(request, response) {
    const req = typeof request === "string" ? new MockRequest(request) : request;
    const res = response.clone ? response.clone() : response;
    const key = normalizeKey(req);
    // Remove first if already exists to preserve insertion order in Map
    this.entries.delete(key);
    this.entries.set(key, { request: req, response: res });
    this.puts.push({ request: req, response: res });
  }

  async match(request) {
    const key = normalizeKey(request);
    const item = this.entries.get(key);
    if (!item) return undefined;
    return item.response.clone ? item.response.clone() : item.response;
  }

  async keys() {
    return Array.from(this.entries.values()).map(e => e.request);
  }

  async delete(request) {
    const key = normalizeKey(request);
    this.deletes.push({ key, request });
    return this.entries.delete(key);
  }
}

class MockCacheStorage {
  constructor(harness) {
    this.harness = harness;
    this.caches = new Map();
  }

  async open(name) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MockCache(name, this.harness));
    }
    return this.caches.get(name);
  }

  async match(request) {
    for (const cache of this.caches.values()) {
      const match = await cache.match(request);
      if (match) return match;
    }
    return undefined;
  }

  async has(name) {
    return this.caches.has(name);
  }

  async delete(name) {
    return this.caches.delete(name);
  }

  async keys() {
    return Array.from(this.caches.keys());
  }
}

function createSWHarness(options = {}) {
  const origin = options.origin || "https://example.com";
  const listeners = {
    install: [],
    activate: [],
    message: [],
    fetch: []
  };

  let skipWaitingCalled = false;
  let clientsClaimCalled = false;
  const networkCalls = [];

  let fetchHandler = async (request) => {
    return new MockResponse("<html>OK</html>", {
      status: 200,
      headers: { "Cache-Control": "public, max-age=3600" }
    });
  };

  const caches = new MockCacheStorage();

  const harness = {
    origin,
    listeners,
    caches,
    networkCalls,
    get skipWaitingCalled() {
      return skipWaitingCalled;
    },
    get clientsClaimCalled() {
      return clientsClaimCalled;
    },
    setFetchHandler(fn) {
      fetchHandler = fn;
    },
    fetch: async (request) => {
      const req = typeof request === "string" ? new MockRequest(request) : request;
      networkCalls.push({ url: req.url, method: req.method, request: req });
      return await fetchHandler(req);
    }
  };
  caches.harness = harness;

  const selfMock = {
    location: {
      origin,
      href: `${origin}/sw.js`
    },
    clients: {
      claim: async () => {
        clientsClaimCalled = true;
        return undefined;
      }
    },
    skipWaiting: () => {
      skipWaitingCalled = true;
    },
    addEventListener: (type, handler) => {
      if (listeners[type]) {
        listeners[type].push(handler);
      }
    }
  };
  selfMock.self = selfMock;

  const context = {
    self: selfMock,
    caches,
    fetch: (req) => harness.fetch(req),
    Response: MockResponse,
    Request: MockRequest,
    URL: URL,
    Promise,
    Array,
    Math,
    console
  };

  const swPath = path.resolve(__dirname, "../../public/sw.js");
  const swCode = fs.readFileSync(swPath, "utf8");
  vm.createContext(context);
  vm.runInContext(swCode, context);

  const getVar = (name) => {
    try {
      return vm.runInContext(name, context);
    } catch {
      return undefined;
    }
  };

  harness.constants = {
    CACHE_VERSION: getVar("CACHE_VERSION"),
    APP_SHELL_CACHE: getVar("APP_SHELL_CACHE"),
    NAVIGATION_CACHE: getVar("NAVIGATION_CACHE"),
    STATIC_ASSET_CACHE: getVar("STATIC_ASSET_CACHE"),
    MAX_NAVIGATION_RESPONSES: getVar("MAX_NAVIGATION_RESPONSES"),
    MAX_STATIC_ASSETS: getVar("MAX_STATIC_ASSETS"),
    APP_SHELL_URLS: getVar("APP_SHELL_URLS"),
    SENSITIVE_PATHS: getVar("SENSITIVE_PATHS")
  };

  harness.triggerInstall = async () => {
    const promises = [];
    const event = {
      waitUntil: (p) => promises.push(Promise.resolve(p))
    };
    for (const handler of listeners.install) {
      handler(event);
    }
    await Promise.all(promises);
  };

  harness.triggerActivate = async () => {
    const promises = [];
    const event = {
      waitUntil: (p) => promises.push(Promise.resolve(p))
    };
    for (const handler of listeners.activate) {
      handler(event);
    }
    await Promise.all(promises);
  };

  harness.triggerMessage = (data) => {
    const event = { data };
    for (const handler of listeners.message) {
      handler(event);
    }
  };

  harness.triggerFetch = async (request) => {
    const req = typeof request === "string" ? new MockRequest(request) : request;
    let responsePromise = null;
    let responded = false;
    const event = {
      request: req,
      respondWith: (promise) => {
        responded = true;
        responsePromise = Promise.resolve(promise);
      }
    };
    for (const handler of listeners.fetch) {
      handler(event);
    }
    if (!responded) {
      return { handled: false, response: null };
    }
    const response = await responsePromise;
    return { handled: true, response };
  };

  return harness;
}

module.exports = {
  createSWHarness,
  MockRequest,
  MockResponse,
  MockHeaders,
  MockCache,
  MockCacheStorage
};
