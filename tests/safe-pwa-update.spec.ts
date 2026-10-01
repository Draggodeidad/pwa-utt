require.extensions[".ts"] = require.extensions[".js"];

const assert = require("node:assert/strict");
const { MessageChannel } = require("node:worker_threads");
const { createSWHarness, MockRequest, MockResponse } = require("./helpers/sw-harness.ts");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { saveDraft } = require("../src/features/inspections/services/local-capture.ts");
const { runQueue } = require("../src/lib/pwa/sync/runner.ts");

async function requestUpdate(harness) {
  const channel = new MessageChannel();
  const result = new Promise(resolve => { channel.port1.onmessage = event => resolve(event.data); });
  await harness.triggerMessage({ type: "PREPARE_AND_ACTIVATE" }, null, [channel.port2]);
  const response = await result;
  channel.port1.close();
  channel.port2.close();
  return response;
}

function tab(prepare) {
  const messages = [];
  return {
    messages,
    postMessage(message, ports) {
      messages.push(message.type);
      if (message.type === "PREPARE_PWA_UPDATE") {
        Promise.resolve().then(prepare).then(
          () => ports[0].postMessage({ ready: true }),
          error => ports[0].postMessage({ ready: false, reason: error.message })
        );
      }
    },
  };
}

async function main() {
  const nextBuild = createSWHarness({ buildId: "v2" });
  assert.notEqual(nextBuild.constants.APP_SHELL_CACHE, createSWHarness({ buildId: "v1" }).constants.APP_SHELL_CACHE);

  // A failed autosave in either tab blocks global activation and releases the others.
  const failed = createSWHarness();
  const first = tab(async () => {});
  const second = tab(async () => { throw new Error("Cuota de IndexedDB agotada"); });
  failed.setClients([first, second]);
  assert.deepEqual(await requestUpdate(failed), { ready: false, reason: "Cuota de IndexedDB agotada" });
  assert.equal(failed.skipWaitingCalled, false);
  assert.ok(first.messages.includes("CANCEL_PWA_UPDATE"));
  assert.ok(second.messages.includes("CANCEL_PWA_UPDATE"));

  // An active send and autosave must both settle before activation.
  const ready = createSWHarness();
  let finishSave;
  const save = new Promise(resolve => { finishSave = resolve; });
  const editing = tab(() => save);
  const idle = tab(async () => {});
  ready.setClients([editing, idle]);
  const update = requestUpdate(ready);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(ready.skipWaitingCalled, false);
  finishSave();
  assert.deepEqual(await update, { ready: true });
  assert.equal(ready.skipWaitingCalled, true);

  // Keep the immediately previous public shell/assets through handover.
  const oldShell = await ready.caches.open("inspecciones-shell-phase-17-v2");
  await oldShell.put(new MockRequest("/_next/static/chunks/old.js"), new MockResponse("old"));
  await ready.triggerActivate();
  assert.equal(await ready.caches.has("inspecciones-shell-phase-17-v2"), true);
  assert.equal((await oldShell.match("/_next/static/chunks/old.js")).body, "old");
  assert.equal((await ready.triggerFetch(new MockRequest("/_next/static/chunks/old.js"))).response.body, "old");

  // A confirmed in-flight ACK is committed; the next operation remains durable.
  const previousDb = globalThis.indexedDB;
  globalThis.indexedDB = createIndexedDbHarness().indexedDB;
  try {
    const owner = "11111111-1111-4111-8111-111111111111";
    const id = "22222222-2222-4222-8222-222222222222";
    const at = "2026-10-01T12:00:00Z";
    const storage = await LocalStorage.open("safe-pwa-update");
    const record = { id, folioNumber: 0, laboratoryId: null, inspectorId: owner, inspectionDate: null,
      summary: "Offline", workflowStatus: "draft", updatedBy: owner, createdAt: at, updatedAt: at,
      version: 0, completedAt: null, deletedAt: null, ownerUserId: owner, localRevision: 1,
      baseVersion: null, syncStatus: "local", localUpdatedAt: at };
    await saveDraft(owner, storage, { owner, inspection: record, findings: [], removedFindings: [] });
    await saveDraft(owner, storage, { owner, inspection: { ...record, summary: "Cambio 2", localRevision: 2 }, findings: [], removedFindings: [] });
    const before = await storage.listQueue(owner);
    let paused = false;
    const sent = [];
    const client = { put: async (_path, body, options) => {
      sent.push(options.operationId);
      paused = true;
      return { operationId: options.operationId, entityId: id, entityType: "inspection", version: 1, folioNumber: 9, appliedAt: at, replayed: false };
    } };
    const outcome = await runQueue(storage, owner, { verifyOwner: async () => true, shouldContinue: () => !paused, client });
    assert.equal(outcome.acknowledged, 1);
    assert.equal(outcome.paused, true);
    assert.deepEqual(sent, [before[0].operationId]);
    const after = await storage.listQueue(owner);
    assert.equal(after.length, 1);
    assert.equal(after[0].operationId, before[1].operationId);
    storage.close();
  } finally {
    globalThis.indexedDB = previousDb;
  }

  console.log("safe-pwa-update.spec.ts: PASS");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
