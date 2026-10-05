const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { ApiClientError } = require("../src/lib/api/client.ts");
const { localStoreSpecs, LOCAL_DB_VERSION } = require("../src/lib/storage/schema.ts");
const { LocalStorageSyncQueue, runQueue } = require("../src/lib/sync/queue.ts");
const { inspectConflict, resolveConflict } = require("../src/lib/sync/conflict-policy.ts");

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

    // 5 repeated transient failures exhaust retries and pause automatic attempts without data loss.
    {
      const storage = await LocalStorage.open("w05-retry-limit");
      const retryInspectionId = "55555555-5555-4555-8555-555555555555";
      const retryOpId = "66666666-6666-4666-8666-666666666666";
      const itemInspection = {
        ...inspection(),
        id: retryInspectionId,
        summary: "Inspección persistente ante 5 fallos",
      };
      const itemIntent = {
        ...intent(),
        operationId: retryOpId,
        entityId: retryInspectionId,
        payload: { summary: "Inspección persistente ante 5 fallos" },
      };
      await storage.saveDraftWithIntent(owner, { store: "inspection_local", value: itemInspection }, itemIntent);

      const failingClient = {
        put: async () => {
          throw new ApiClientError(503, { code: "SERVICE_UNAVAILABLE", message: "Servidor caído" });
        },
      };

      let virtualClock = 2_000_000;
      const transport = { client: failingClient, verifyOwner: async (id) => id === owner, now: () => virtualClock };

      for (let attempt = 1; attempt <= 5; attempt++) {
        const result = await runQueue(storage, owner, transport);
        assert.equal(result.failed, 1, `attempt ${attempt} must record failure`);
        const queueItems = await storage.listQueue(owner);
        assert.equal(queueItems.length, 1);
        const current = queueItems[0];
        assert.equal(current.attempts, attempt);
        if (attempt < 5) {
          assert.equal(current.retryExhausted, false);
          assert.ok(current.nextAttemptAt, `attempt ${attempt} must schedule next attempt`);
          virtualClock = Date.parse(current.nextAttemptAt) + 1;
        } else {
          assert.equal(current.retryExhausted, true);
          assert.equal(current.nextAttemptAt, null);
          assert.equal(current.status, "error");
        }
      }

      // Next execution with advanced clock must NOT retry exhausted item (queue suspended for this item)
      virtualClock += 1_000_000;
      const suspendedRun = await runQueue(storage, owner, transport);
      assert.equal(suspendedRun.failed, 0);
      assert.equal(suspendedRun.acknowledged, 0);

      // Local entity remains intact and uncorrupted in storage
      const persisted = await storage.getInspection(owner, retryInspectionId);
      assert.equal(persisted.summary, "Inspección persistente ante 5 fallos");
      storage.close();
    }

    // Conflict resolution with 'mine' (keeps local edits, rebases to remote baseVersion)
    {
      const storage = await LocalStorage.open("w05-conflict-mine");
      const confInspId = "77777777-7777-4777-8777-777777777777";
      const confOpId = "88888888-8888-4888-8888-888888888888";
      const localRecord = {
        ...inspection(),
        id: confInspId,
        summary: "Mi captura local técnica",
        version: 1,
        baseVersion: 1,
      };
      const updateIntent = {
        operationId: confOpId, ownerUserId: owner, entity: "inspection", entityId: confInspId,
        operation: "inspection.update", payload: { summary: "Mi captura local técnica" },
        baseVersion: 1, dependsOn: [], localOrder: 1, attempts: 0,
        nextAttemptAt: null, lastError: null, createdAt: timestamp, status: "pending",
      };
      await storage.saveInspection(owner, localRecord);
      await storage.enqueue(owner, updateIntent);

      const remoteSnapshot = {
        id: confInspId, folio: "INS-77", folioNumber: 77, location: "Laboratorio W05",
        laboratoryId: null, laboratoryCode: "LAB-01", inspectionDate: "2026-09-30",
        date: "2026-09-30", technician: "Inspector Servidor", workflowStatus: "draft",
        result: "without_findings", syncStatus: "synced", scope: "Versión remota concurrente",
        findings: [], version: 2,
      };

      const conflictClient = {
        get: async () => remoteSnapshot,
        patch: async () => {
          throw new ApiClientError(409, {
            code: "VERSION_CONFLICT",
            message: "Conflicto de versión remota",
            remoteSnapshot: { secret: "do-not-trust" },
          });
        },
      };

      const conflictTransport = { client: conflictClient, verifyOwner: async () => true };
      const queueRun = await runQueue(storage, owner, conflictTransport);
      assert.equal(queueRun.failed, 1);

      const conflictRecord = await storage.getConflict(owner, confOpId);
      assert.ok(conflictRecord, "conflict must be recorded in conflict_local");
      assert.equal(conflictRecord.reason, "version");
      assert.equal(conflictRecord.remoteVersion, 2);

      const resContext = {
        storage,
        client: conflictClient,
        owner,
        verifyOwner: async (id) => (id === owner ? "technician" : null),
      };

      await resolveConflict(resContext, confOpId, "mine");

      const resolvedRecord = await storage.getConflict(owner, confOpId);
      assert.equal(resolvedRecord.resolution, "mine");
      assert.ok(resolvedRecord.resolvedAt);

      const queue = await storage.listQueue(owner);
      assert.equal(queue.length, 1);
      const rebased = queue[0];
      assert.notEqual(rebased.operationId, confOpId, "mine creates a fresh rebased operation");
      assert.equal(rebased.baseVersion, 2, "baseVersion updated to remote version");
      assert.equal(rebased.payload.summary, "Mi captura local técnica", "local edits preserved");

      const inspectionLocal = await storage.getInspection(owner, confInspId);
      assert.equal(inspectionLocal.summary, "Mi captura local técnica");

      storage.close();
    }

    // Conflict resolution with 'server' (adopts authorized remote snapshot and clears queue)
    {
      const storage = await LocalStorage.open("w05-conflict-server");
      const srvInspId = "99999999-9999-4999-8999-999999999999";
      const srvOpId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const localRecord = {
        ...inspection(),
        id: srvInspId,
        summary: "Mi captura local descartable",
        version: 1,
        baseVersion: 1,
      };
      const updateIntent = {
        operationId: srvOpId, ownerUserId: owner, entity: "inspection", entityId: srvInspId,
        operation: "inspection.update", payload: { summary: "Mi captura local descartable" },
        baseVersion: 1, dependsOn: [], localOrder: 1, attempts: 0,
        nextAttemptAt: null, lastError: null, createdAt: timestamp, status: "pending",
      };
      await storage.saveInspection(owner, localRecord);
      await storage.enqueue(owner, updateIntent);

      const remoteSnapshot = {
        id: srvInspId, folio: "INS-99", folioNumber: 99, location: "Laboratorio W05",
        laboratoryId: null, laboratoryCode: "LAB-01", inspectionDate: "2026-09-30",
        date: "2026-09-30", technician: "Inspector Remoto", workflowStatus: "draft",
        result: "without_findings", syncStatus: "synced", scope: "Versión oficial del servidor",
        findings: [], version: 3,
      };

      const conflictClient = {
        get: async () => remoteSnapshot,
        patch: async () => {
          throw new ApiClientError(409, {
            code: "VERSION_CONFLICT",
            message: "Conflicto concurrente",
            remoteSnapshot: { secret: "do-not-trust" },
          });
        },
      };

      await runQueue(storage, owner, { client: conflictClient, verifyOwner: async () => true });

      const resContext = {
        storage,
        client: conflictClient,
        owner,
        verifyOwner: async (id) => (id === owner ? "technician" : null),
      };

      await resolveConflict(resContext, srvOpId, "server");

      const resolvedRecord = await storage.getConflict(owner, srvOpId);
      assert.equal(resolvedRecord.resolution, "server");
      assert.ok(resolvedRecord.resolvedAt);

      const queue = await storage.listQueue(owner);
      assert.equal(queue.length, 0, "queue cleared after server resolution");

      const adopted = await storage.getInspection(owner, srvInspId);
      assert.equal(adopted.summary, "Versión oficial del servidor", "adopted remote scope");
      assert.equal(adopted.baseVersion, 3);
      assert.equal(adopted.version, 3);
      assert.equal(adopted.syncStatus, "synced");

      storage.close();
    }

    console.log("sync.spec.ts: PASS");
  } finally {
    globalThis.indexedDB = previous;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
