// Local storage spec: exercises the partitioned IndexedDB storage against an
// in-memory IndexedDB harness (atomic transactions, injectable quota/errors,
// version incompatibility). No browser or real database is used.
const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage, PartitionRequiredError } = require("../src/lib/pwa/offline-storage.ts");
const { LocalStorageSyncQueue } = require("../src/lib/pwa/sync/queue.ts");

const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";

function makeInspection(id, owner, extra = {}) {
  return {
    id, folioNumber: 0, laboratoryId: null, inspectorId: owner, inspectionDate: null,
    summary: "", workflowStatus: "draft", updatedBy: owner, createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z", version: 0, completedAt: null, deletedAt: null,
    ownerUserId: owner, localRevision: 1, baseVersion: null, syncStatus: "local",
    localUpdatedAt: "2026-09-30T00:00:00Z", ...extra,
  };
}

function makeFinding(id, inspectionId, owner) {
  return {
    id, inspectionId, title: "", description: "", priority: "medium", status: "pending",
    createdBy: owner, updatedBy: owner, createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z", version: 0, resolvedAt: null, deletedAt: null,
    ownerUserId: owner, localRevision: 1, baseVersion: null, syncStatus: "local",
    localUpdatedAt: "2026-09-30T00:00:00Z",
  };
}

function makeIntent(operationId, owner, entityId, operation = "inspection.create") {
  return {
    operationId, ownerUserId: owner,
    entity: operation.startsWith("inspection") ? "inspection" : "finding",
    entityId, operation, payload: {}, baseVersion: null, dependsOn: [], localOrder: 1,
    attempts: 0, nextAttemptAt: null, lastError: null, createdAt: "2026-09-30T00:00:00Z", status: "pending",
  };
}

async function main() {
  const harness = createIndexedDbHarness();
  const originalIndexedDb = globalThis.indexedDB;
  globalThis.indexedDB = harness.indexedDB;
  try {
    // Reload recovers an incomplete draft, its intent and the local revisions.
    {
      const storage = await LocalStorage.open("c1");
      const inspection = makeInspection("ins-1", ownerA, {
        summary: "", localRevision: 3, baseVersion: 2, syncStatus: "pending",
        localUpdatedAt: "2026-09-30T05:00:00Z",
      });
      await storage.saveDraftWithIntent(ownerA, { store: "inspection_local", value: inspection }, makeIntent("op-1", ownerA, "ins-1"));
      storage.close();

      const reopened = await LocalStorage.open("c1");
      const recovered = await reopened.getInspection(ownerA, "ins-1");
      assert.equal(recovered.id, "ins-1");
      assert.equal(recovered.summary, "", "el borrador incompleto es durable");
      assert.equal(recovered.localRevision, 3, "revisión local preservada");
      assert.equal(recovered.baseVersion, 2, "baseVersion preservada");
      assert.equal(recovered.syncStatus, "pending");
      const queue = await reopened.listQueue(ownerA);
      assert.equal(queue.length, 1, "la intención sobrevive a la recarga");
      assert.equal(queue[0].operationId, "op-1");
      assert.equal(queue[0].status, "pending");
      reopened.close();
    }

    // Failing the second write rolls back both; success never resolves.
    {
      const storage = await LocalStorage.open("c1-atomic");
      const inspection = makeInspection("ins-atomic", ownerA);
      harness.failNextPut("sync_queue", new Error("QuotaExceededError"));
      await assert.rejects(() => storage.saveDraftWithIntent(ownerA, { store: "inspection_local", value: inspection }, makeIntent("op-atomic", ownerA, "ins-atomic")));
      assert.equal(await storage.getInspection(ownerA, "ins-atomic"), null, "la entidad se revierte con la intención");
      assert.equal((await storage.listQueue(ownerA)).length, 0, "no queda intención huérfana");
      storage.close();
    }

    // Partition isolation: A never reads, lists, edits or removes B's records.
    {
      const storage = await LocalStorage.open("c2");
      await storage.saveInspection(ownerA, makeInspection("ins-a", ownerA));
      await storage.saveFinding(ownerA, makeFinding("fin-a", "ins-a", ownerA));
      await storage.enqueue(ownerA, makeIntent("op-a", ownerA, "ins-a"));
      await storage.saveCatalog(ownerA, [{ id: "lab-1", code: "LAB-01", name: "Lab 01" }]);

      assert.equal(await storage.getInspection(ownerB, "ins-a"), null, "B no lee inspecciones de A");
      assert.equal((await storage.listInspections(ownerB)).length, 0, "B no lista inspecciones de A");
      assert.equal(await storage.getFinding(ownerB, "fin-a"), null, "B no lee hallazgos de A");
      assert.equal((await storage.listFindings(ownerB)).length, 0, "B no lista hallazgos de A");
      assert.equal((await storage.listQueue(ownerB)).length, 0, "B no lista la cola de A");
      assert.equal((await storage.getCatalog(ownerB)).length, 0, "B no ve el catálogo de A");

      await storage.removeInspection(ownerB, "ins-a");
      await storage.removeFinding(ownerB, "fin-a");
      await storage.markComplete(ownerB, "op-a");
      assert.ok(await storage.getInspection(ownerA, "ins-a"), "B no elimina inspecciones de A");
      assert.ok(await storage.getFinding(ownerA, "fin-a"), "B no elimina hallazgos de A");
      assert.equal((await storage.listQueue(ownerA)).length, 1, "B no toca la cola de A");

      await assert.rejects(() => storage.listInspections(""), PartitionRequiredError, "sin partición activa se bloquea");
      await assert.rejects(() => storage.saveInspection(ownerA, makeInspection("x", ownerB)), PartitionRequiredError, "partición ajena se bloquea");
      await assert.rejects(
        () => storage.saveDraftWithIntent(ownerA, { store: "inspection_local", value: makeInspection("y", ownerB) }, makeIntent("op-b", ownerA, "y")),
        PartitionRequiredError
      );
      storage.close();
    }

    // clientId: stable on reopen, different across independent installations.
    {
      const storage = await LocalStorage.open("install-a");
      const first = await storage.getClientId();
      assert.equal(await storage.getClientId(), first, "clientId estable en la misma apertura");
      storage.close();

      const reopened = await LocalStorage.open("install-a");
      assert.equal(await reopened.getClientId(), first, "reabrir conserva clientId");
      reopened.close();

      const other = await LocalStorage.open("install-b");
      assert.notEqual(await other.getClientId(), first, "instalación independiente genera otro clientId");
      other.close();
    }

    // Incompatible open surfaces an explicit error and never deletes data.
    {
      const future = await new Promise((resolve, reject) => {
        const request = harness.indexedDB.open("incompat", 2);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("future", { keyPath: "id" });
          store.put({ id: "keep", value: 1 });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      future.close();

      await assert.rejects(() => LocalStorage.open("incompat"), /version/i, "apertura incompatible es error explícito");

      const check = await new Promise((resolve, reject) => {
        const request = harness.indexedDB.open("incompat", 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const keep = await new Promise((resolve, reject) => {
        const tx = check.transaction("future", "readonly");
        const get = tx.objectStore("future").get("keep");
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      assert.equal(keep.value, 1, "la apertura incompatible no borra datos previos");
      check.close();
    }

    // Quota failure never reports a successful save.
    {
      const storage = await LocalStorage.open("quota");
      harness.failNextPut("inspection_local", new Error("QuotaExceededError"));
      await assert.rejects(() => storage.saveInspection(ownerA, makeInspection("q1", ownerA)));
      assert.equal(await storage.getInspection(ownerA, "q1"), null, "no queda escritura parcial ni éxito falso");
      storage.close();
    }

    // Queue facade bound to an active partition.
    {
      const storage = await LocalStorage.open("queue");
      const queue = new LocalStorageSyncQueue(storage, ownerA);
      await queue.enqueue(makeIntent("op-q", ownerA, "ins-q", "inspection.update"));
      const pending = await queue.listPending();
      assert.equal(pending.length, 1);
      await queue.markComplete("op-q");
      assert.equal((await storage.listQueue(ownerA)).length, 0);
      storage.close();
    }

    console.log("local-storage.spec.ts: PASS");
  } finally {
    globalThis.indexedDB = originalIndexedDb;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });