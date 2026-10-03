const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { ApiClientError } = require("../src/lib/api/client.ts");
const { localStoreSpecs, LOCAL_DB_VERSION } = require("../src/lib/storage/schema.ts");
const { LocalStorageSyncQueue, runQueue } = require("../src/lib/sync/queue.ts");
const { inspectConflict } = require("../src/lib/sync/conflict-policy.ts");

const owner = "11111111-1111-4111-8111-111111111111";
const otherOwner = "22222222-2222-4222-8222-222222222222";
const inspectionId = "33333333-3333-4333-8333-333333333333";
const operationId = "44444444-4444-4444-8444-444444444444";
const timestamp = "2026-09-30T00:00:00.000Z";

function inspection() {
  return {
    id: inspectionId, folioNumber: 0, laboratoryId: null, inspectorId: owner,
    inspectionDate: "2026-09-30", summary: "Inspección sintética W05",
    workflowStatus: "draft", updatedBy: owner, createdAt: timestamp,
    updatedAt: timestamp, version: 0, completedAt: null, deletedAt: null,
    ownerUserId: owner, localRevision: 1, baseVersion: null,
    syncStatus: "local", localUpdatedAt: timestamp,
  };
}

function intent() {
  return {
    operationId, ownerUserId: owner, entity: "inspection", entityId: inspectionId,
    operation: "inspection.create", payload: { summary: "Inspección sintética W05" },
    baseVersion: null, dependsOn: [], localOrder: 1, attempts: 0,
    nextAttemptAt: null, lastError: null, createdAt: timestamp, status: "pending",
  };
}

async function main() {
  assert.ok(LOCAL_DB_VERSION >= 1);
  assert.ok(localStoreSpecs.some((store) => store.name === "sync_queue" && store.keyPath === "operationId"));
  const harness = createIndexedDbHarness();
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = harness.indexedDB;
  try {
    // The W05 schema/queue paths preserve an entity and its intent through a reload.
    let storage = await LocalStorage.open("w05-replay");
    await storage.saveDraftWithIntent(owner, { store: "inspection_local", value: inspection() }, intent());
    storage.close();
    storage = await LocalStorage.open("w05-replay");
    const queue = new LocalStorageSyncQueue(storage, owner);
    assert.equal((await storage.getInspection(owner, inspectionId)).summary, "Inspección sintética W05");
    assert.equal((await queue.listPending()).length, 1);
    assert.equal((await storage.listQueue(otherOwner)).length, 0, "other account cannot see this intent");

    // A lost ACK replays the identical key and request, producing one remote receipt.
    const receipts = new Map();
    const calls = [];
    let loseAck = true;
    const client = {
      put: async (path, body, options) => {
        calls.push({ path, body: structuredClone(body), key: options.operationId });
        if (!receipts.has(options.operationId)) {
          receipts.set(options.operationId, {
            operationId: options.operationId, entityId: body.entityId,
            entityType: "inspection", version: 1, folioNumber: 17,
            appliedAt: timestamp, replayed: false,
          });
        }
        if (loseAck) { loseAck = false; throw new Error("synthetic lost ACK"); }
        return { ...receipts.get(options.operationId), replayed: true };
      },
    };
    let now = 1_000_000;
    const transport = { client, verifyOwner: async (id) => id === owner, now: () => now };
    assert.equal((await runQueue(storage, owner, transport)).failed, 1);
    const frozen = (await queue.listPending())[0];
    assert.ok(frozen.frozenRequest);
    storage.close();
    storage = await LocalStorage.open("w05-replay");
    now = Date.parse(frozen.nextAttemptAt);
    assert.equal((await runQueue(storage, owner, transport)).acknowledged, 1);
    assert.deepEqual(calls[0], calls[1], "retry must preserve the complete request and key");
    assert.equal(receipts.size, 1, "one remote operation after replay");
    assert.equal((await storage.listQueue(owner)).length, 0);
    assert.equal((await storage.getInspection(owner, inspectionId)).baseVersion, 1);
    storage.close();

    // Conflict evidence must come from an authorized read, never an error body.
    const sent = { ...intent(), frozenRequest: { clientId: owner, kind: "inspection.create", entityId: inspectionId, baseVersion: null, payload: intent().payload } };
    const remote = { id: inspectionId, version: 2, workflowStatus: "draft", scope: "Servidor sintético" };
    const conflict = await inspectConflict(
      { get: async () => remote }, sent,
      new ApiClientError(409, { code: "VERSION_CONFLICT", message: "conflict", remoteSnapshot: { scope: "untrusted" } }),
    );
    assert.equal(conflict.reason, "version");
    assert.deepEqual(conflict.remoteSnapshot, remote);
    assert.equal(conflict.remoteVersion, 2);
    console.log("sync.spec.ts: PASS");
  } finally {
    globalThis.indexedDB = previous;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
