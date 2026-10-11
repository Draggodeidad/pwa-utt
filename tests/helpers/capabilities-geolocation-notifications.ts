// W06 #71 behavior checks for the existing location and notification adapters.
"use strict";

const assert = require("node:assert/strict");

function importAdaptersWithoutBrowserGlobals() {
  const names = ["window", "navigator", "Notification"];
  const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const paths = [
    "../../src/lib/device/geolocation.ts",
    "../../src/lib/notifications/client.ts",
    "../../src/lib/notifications/browser.ts",
    "../../src/lib/notifications/sync-event.ts",
  ].map((path) => require.resolve(path));
  const cached = new Map(paths.map((path) => [path, require.cache[path]]));

  try {
    for (const name of names) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() { throw new Error(`SSR import read global ${name}`); },
      });
    }
    for (const path of paths) delete require.cache[path];
    return paths.map((path) => require(path));
  } finally {
    for (const name of names) {
      const descriptor = descriptors.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    for (const [path, module] of cached) {
      delete require.cache[path];
      if (module) require.cache[path] = module;
    }
  }
}

const [geolocationModule, notificationsModule, browserNotificationsModule, syncEventModule] = importAdaptersWithoutBrowserGlobals();
const { createGeolocationClient } = geolocationModule;
const { createNotificationsClient } = notificationsModule;
const { createBrowserNotificationApi } = browserNotificationsModule;
const { confirmedSyncCompletion } = syncEventModule;
const { createIndexedDbHarness } = require("./indexed-db-harness.ts");
const { LocalStorage } = require("../../src/lib/pwa/offline-storage.ts");
const { saveDraft } = require("../../src/features/inspections/services/local-capture.ts");

const owner = "11111111-1111-4111-8111-111111111171";
const inspectionId = "33333333-3333-4333-8333-333333333171";
const timestamp = "2026-10-11T12:00:00.000Z";

function event(id = `${owner}:operation-1`) {
  return { id, kind: "sync-completed", title: "Sync sintética", body: "Cambios sintéticos confirmados." };
}

function makeNotificationApi(overrides = {}) {
  const calls = { permission: 0, requestPermission: 0, show: 0 };
  let currentPermission = overrides.initialPermission ?? "granted";
  return {
    calls,
    api: {
      permission() {
        calls.permission++;
        return currentPermission;
      },
      async requestPermission() {
        calls.requestPermission++;
        if (overrides.requestPermission) currentPermission = await overrides.requestPermission(calls.requestPermission);
        return currentPermission;
      },
      async show(confirmedEvent) {
        calls.show++;
        if (overrides.show) return overrides.show(confirmedEvent, calls.show);
      },
    },
    setPermission(permission) { currentPermission = permission; },
  };
}

function withGlobalValue(name, value, action) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  try { return action(); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

function syntheticCapture() {
  return {
    owner,
    inspection: {
      id: inspectionId, folioNumber: 0, laboratoryId: null, inspectorId: owner,
      inspectionDate: "2026-10-11", summary: "Inspección sintética sin GPS",
      workflowStatus: "draft", updatedBy: owner, createdAt: timestamp,
      updatedAt: timestamp, version: 0, completedAt: null, deletedAt: null,
      ownerUserId: owner, localRevision: 1, baseVersion: null,
      syncStatus: "local", localUpdatedAt: timestamp,
    },
    findings: [],
    removedFindings: [],
  };
}

async function runGeolocationNotificationsSuite() {
  let scenarios = 0;

  // Imports must remain safe in Node/SSR even when browser globals throw.
  assert.equal(typeof createGeolocationClient, "function");
  assert.equal(typeof createNotificationsClient, "function");
  assert.equal(typeof createBrowserNotificationApi, "function");
  assert.equal(typeof confirmedSyncCompletion, "function");
  scenarios++;

  // A missing browser Notification API is represented as unsupported by the real adapter.
  const absentBrowserApi = withGlobalValue("Notification", undefined, () => createBrowserNotificationApi(() => true));
  assert.equal(absentBrowserApi, null);
  scenarios++;

  // Geolocation is lazy: construction does not call the browser port; locate is the explicit action.
  {
    let calls = 0;
    let receivedOptions;
    const client = createGeolocationClient({
      isSecureContext: () => true,
      geolocation: { getCurrentPosition(success, _error, options) {
        calls++;
        receivedOptions = options;
        success({ coords: { latitude: 12.345, longitude: 45.678, accuracy: 30 } });
      } },
      now: () => 123456,
    });
    assert.equal(calls, 0, "la factory no solicita ubicación al construirse");
    const located = await client.locate();
    assert.equal(calls, 1, "la solicitud ocurre al llamar locate");
    assert.deepEqual(located, { status: "success", value: { latitude: 12.345, longitude: 45.678, accuracy: 30, capturedAt: 123456 } });
    assert.deepEqual(receivedOptions, { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 });
    scenarios++;
  }

  // Permission denial maps to the manual-laboratory fallback.
  {
    let calls = 0;
    const client = createGeolocationClient({
      isSecureContext: () => true,
      geolocation: { getCurrentPosition(_success, error) { calls++; error({ code: 1 }); } },
      now: () => 0,
    });
    assert.deepEqual(await client.locate(), { status: "denied", code: "permission-denied", fallback: "manual-laboratory" });
    assert.equal(calls, 1);
    scenarios++;
  }

  // Browser timeout maps to the same non-blocking manual fallback.
  {
    const client = createGeolocationClient({
      isSecureContext: () => true,
      geolocation: { getCurrentPosition(_success, error) { error({ code: 3 }); } },
      now: () => 0,
    });
    assert.deepEqual(await client.locate(), { status: "error", code: "timeout", fallback: "manual-laboratory" });
    scenarios++;
  }

  // Unavailable position and absent API have distinct error/unsupported results.
  {
    const unavailable = createGeolocationClient({
      isSecureContext: () => true,
      geolocation: { getCurrentPosition(_success, error) { error({ code: 2 }); } },
      now: () => 0,
    });
    assert.deepEqual(await unavailable.locate(), { status: "error", code: "position-unavailable", fallback: "manual-laboratory" });
    const absent = createGeolocationClient({ isSecureContext: () => true, geolocation: null, now: () => 0 });
    assert.deepEqual(await absent.locate(), { status: "unsupported", code: "api-unavailable", fallback: "manual-laboratory" });
    scenarios++;
  }

  // Insecure context rejects before touching the geolocation port.
  {
    let calls = 0;
    const client = createGeolocationClient({
      isSecureContext: () => false,
      geolocation: { getCurrentPosition() { calls++; } },
      now: () => 0,
    });
    assert.deepEqual(await client.locate(), { status: "unsupported", code: "insecure-context", fallback: "manual-laboratory" });
    assert.equal(calls, 0);
    scenarios++;
  }

  // Invalid coordinates fail closed; no location is returned as success.
  {
    const client = createGeolocationClient({
      isSecureContext: () => true,
      geolocation: { getCurrentPosition(success) { success({ coords: { latitude: 91, longitude: 0, accuracy: 1 } }); } },
      now: () => 0,
    });
    assert.deepEqual(await client.locate(), { status: "error", code: "position-unavailable", fallback: "manual-laboratory" });
    scenarios++;
  }

  // A denied location does not prevent the real local inspection capture path.
  {
    const deniedClient = createGeolocationClient({
      isSecureContext: () => true,
      geolocation: { getCurrentPosition(_success, error) { error({ code: 1 }); } },
      now: () => 0,
    });
    assert.equal((await deniedClient.locate()).status, "denied");
    const harness = createIndexedDbHarness();
    const previousIndexedDb = globalThis.indexedDB;
    globalThis.indexedDB = harness.indexedDB;
    try {
      let storage = await LocalStorage.open("w06-location-optional");
      await saveDraft(owner, storage, syntheticCapture());
      storage.close();
      storage = await LocalStorage.open("w06-location-optional");
      assert.equal((await storage.getInspection(owner, inspectionId)).summary, "Inspección sintética sin GPS");
      assert.equal((await storage.listQueue(owner)).length, 1);
      assert.equal("location" in (await storage.listQueue(owner))[0].payload, false);
      storage.close();
    } finally { globalThis.indexedDB = previousIndexedDb; }
    scenarios++;
  }

  // Notification client construction and confirmed delivery never prompt for permission.
  {
    const notification = makeNotificationApi({ initialPermission: "granted" });
    const client = createNotificationsClient({ isSecureContext: () => true, api: notification.api, now: () => 1, presentFallback() {} });
    assert.deepEqual(notification.calls, { permission: 0, requestPermission: 0, show: 0 });
    assert.equal((await client.showConfirmed(event())).status, "success");
    assert.equal(notification.calls.requestPermission, 0, "showConfirmed no solicita permiso");
    assert.equal(notification.calls.show, 1);
    scenarios++;
  }

  // Permission default is requested only by requestPermission; granted is not re-prompted.
  {
    const notification = makeNotificationApi({
      initialPermission: "default",
      requestPermission: async () => "granted",
    });
    const client = createNotificationsClient({ isSecureContext: () => true, api: notification.api, now: () => 1, presentFallback() {} });
    assert.deepEqual(await client.requestPermission(), { status: "success", value: "granted" });
    assert.equal(notification.calls.requestPermission, 1);
    assert.deepEqual(await client.requestPermission(), { status: "success", value: "granted" });
    assert.equal(notification.calls.requestPermission, 1, "permiso ya concedido no se vuelve a pedir");
    scenarios++;
  }

  // Denied/default/API missing/security errors preserve the in-app path.
  {
    const denied = makeNotificationApi({ initialPermission: "denied" });
    const deniedFallback = [];
    const deniedClient = createNotificationsClient({ isSecureContext: () => true, api: denied.api, now: () => 1, presentFallback: item => deniedFallback.push(item.id) });
    assert.deepEqual(await deniedClient.requestPermission(), { status: "denied", code: "permission-denied", fallback: "in-app" });
    assert.deepEqual(await deniedClient.showConfirmed(event("denied-event")), { status: "denied", code: "permission-denied", fallback: "in-app" });
    assert.deepEqual(deniedFallback, ["denied-event"]);
    const defaultApi = makeNotificationApi({ initialPermission: "default" });
    const defaultFallback = [];
    const defaultClient = createNotificationsClient({ isSecureContext: () => true, api: defaultApi.api, now: () => 1, presentFallback: item => defaultFallback.push(item.id) });
    assert.deepEqual(await defaultClient.showConfirmed(event("default-event")), { status: "error", code: "permission-default", fallback: "in-app" });
    assert.equal(defaultApi.calls.requestPermission, 0, "mostrar evento no convierte default en prompt");
    assert.deepEqual(defaultFallback, ["default-event"]);
    const absentClient = createNotificationsClient({ isSecureContext: () => true, api: null, now: () => 1, presentFallback() {} });
    assert.deepEqual(await absentClient.requestPermission(), { status: "unsupported", code: "api-unavailable", fallback: "in-app" });
    assert.deepEqual(await absentClient.showConfirmed(event("absent-event")), { status: "unsupported", code: "api-unavailable", fallback: "in-app" });
    const insecureClient = createNotificationsClient({ isSecureContext: () => false, api: denied.api, now: () => 1, presentFallback() {} });
    assert.deepEqual(await insecureClient.requestPermission(), { status: "unsupported", code: "insecure-context", fallback: "in-app" });
    scenarios++;
  }

  // A rejected permission request can be explicitly retried by a later user action.
  {
    const notification = makeNotificationApi({
      initialPermission: "default",
      requestPermission: async attempt => {
        if (attempt === 1) throw new Error("synthetic permission API failure");
        return "granted";
      },
    });
    const client = createNotificationsClient({ isSecureContext: () => true, api: notification.api, now: () => 1, presentFallback() {} });
    assert.deepEqual(await client.requestPermission(), { status: "error", code: "notification-failed", fallback: "in-app" });
    assert.deepEqual(await client.requestPermission(), { status: "success", value: "granted" });
    assert.equal(notification.calls.requestPermission, 2);
    scenarios++;
  }

  // A failed native presentation falls back in-app; the same event ID is consumed once.
  {
    const notification = makeNotificationApi({ show: async () => { throw new Error("synthetic show failure"); } });
    const fallback = [];
    const client = createNotificationsClient({ isSecureContext: () => true, api: notification.api, now: () => 2, presentFallback: item => fallback.push(item.id) });
    assert.deepEqual(await client.showConfirmed(event("failed-show")), { status: "error", code: "notification-failed", fallback: "in-app" });
    assert.deepEqual(await client.showConfirmed(event("failed-show")), { status: "success", value: { eventId: "failed-show", delivery: "already-shown" } });
    assert.equal(notification.calls.show, 1);
    assert.deepEqual(fallback, ["failed-show"]);
    scenarios++;
  }

  // Concurrent and later duplicates share a single native presentation.
  {
    let finishShow;
    const notification = makeNotificationApi({ show: () => new Promise(resolve => { finishShow = resolve; }) });
    const client = createNotificationsClient({ isSecureContext: () => true, api: notification.api, now: () => 3, presentFallback() {} });
    const first = client.showConfirmed(event("concurrent-event"));
    const second = client.showConfirmed(event("concurrent-event"));
    await Promise.resolve();
    assert.equal(notification.calls.show, 1);
    finishShow();
    assert.deepEqual(await first, { status: "success", value: { eventId: "concurrent-event", delivery: "shown" } });
    assert.deepEqual(await second, { status: "success", value: { eventId: "concurrent-event", delivery: "already-shown" } });
    assert.deepEqual(await client.showConfirmed(event("concurrent-event")), { status: "success", value: { eventId: "concurrent-event", delivery: "already-shown" } });
    assert.equal(notification.calls.show, 1);
    scenarios++;
  }

  // Only a newly acknowledged, fully settled synchronization creates a notification event.
  {
    const base = {
      owner, epoch: "session-epoch-synthetic", lastAcknowledgedId: "operation-synthetic",
      outcome: { acknowledged: 1, failed: 0, paused: false }, pendingCount: 0,
      unresolvedConflicts: 0, sessionCurrent: true, updatePaused: false,
    };
    const confirmed = confirmedSyncCompletion(base);
    assert.equal(confirmed.owner, owner);
    assert.equal(confirmed.epoch, base.epoch);
    assert.equal(confirmed.event.id, `${owner}:operation-synthetic`);
    assert.equal(confirmed.event.kind, "sync-completed");
    assert.equal(confirmed.event.body.includes("laboratorio"), false, "el texto no expone datos de inspección");
    for (const changes of [
      { lastAcknowledgedId: null },
      { outcome: { acknowledged: 0, failed: 0, paused: false } },
      { outcome: { acknowledged: 1, failed: 1, paused: false } },
      { outcome: { acknowledged: 1, failed: 0, paused: true } },
      { pendingCount: 1 },
      { unresolvedConflicts: 1 },
      { sessionCurrent: false },
      { updatePaused: true },
    ]) assert.equal(confirmedSyncCompletion({ ...base, ...changes }), null);
    scenarios++;
  }

  return scenarios;
}

module.exports = { runGeolocationNotificationsSuite };
exports.runGeolocationNotificationsSuite = runGeolocationNotificationsSuite;

if (require.main === module) {
  runGeolocationNotificationsSuite()
    .then((count) => console.log(`capabilities-geolocation-notifications.ts: PASS (${count} scenarios)`))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}