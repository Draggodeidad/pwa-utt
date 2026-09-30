// Local capture spec: exercises the local-first engine (save/finalize/discard,
// recovery, refresh merge) against the in-memory IndexedDB harness. No browser
// or real network is used.
const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const {
  saveDraft,
  finalizeDraft,
  discardDraft,
  loadLocalDraft,
  mergeRemoteRefresh,
  hasPendingFinalization,
  enqueueFinalizeIntent,
} = require("../src/features/inspections/services/local-capture.ts");

const owner = "11111111-1111-4111-8111-111111111111";

function makeLocalInspection(id, opts = {}) {
  return {
    id, folioNumber: 0, laboratoryId: "lab-1", inspectorId: owner, inspectionDate: "2026-09-30",
    summary: "", workflowStatus: "draft", updatedBy: owner, createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z", version: 0, completedAt: null, deletedAt: null,
    ownerUserId: owner, localRevision: 1, baseVersion: null, syncStatus: "local",
    localUpdatedAt: "2026-09-30T00:00:00Z", ...opts,
  };
}

function makeLocalFinding(id, inspectionId, opts = {}) {
  return {
    id, inspectionId, title: "Cableado", description: "Revisión", priority: "medium", status: "pending",
    createdBy: owner, updatedBy: owner, createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z",
    version: 0, resolvedAt: null, deletedAt: null, ownerUserId: owner, localRevision: 1,
    baseVersion: null, syncStatus: "local", localUpdatedAt: "2026-09-30T00:00:00Z", ...opts,
  };
}

function makeIntent(operationId, entityId, operation, baseVersion, localOrder) {
  return {
    operationId, ownerUserId: owner, entity: operation.startsWith("inspection") ? "inspection" : "finding",
    entityId, operation, payload: {}, baseVersion, dependsOn: [], localOrder,
    attempts: 0, nextAttemptAt: null, lastError: null, createdAt: "2026-09-30T00:00:00Z", status: "pending",
  };
}

async function main() {
  const harness = createIndexedDbHarness();
  const originalIndexedDb = globalThis.indexedDB;
  globalThis.indexedDB = harness.indexedDB;
  try {
    // Reload recovers an incomplete draft with a finding plus its intents.
    {
      const storage = await LocalStorage.open("lc1");
      const intents = await saveDraft(owner, storage, {
        owner,
        inspection: makeLocalInspection("ins-1", { summary: "", inspectionDate: null }),
        findings: [makeLocalFinding("fin-1", "ins-1")],
        removedFindings: [],
      });
      assert.equal(intents.length, 2, "inspection + finding intents");
      assert.equal(intents[0].operation, "inspection.create");
      assert.equal(intents[1].operation, "finding.create");
      assert.deepEqual(intents[1].dependsOn, [intents[0].operationId], "el hallazgo depende de la inspección");
      storage.close();

      const reopened = await LocalStorage.open("lc1");
      const draft = await loadLocalDraft(owner, reopened, "ins-1");
      assert.equal(draft.inspection.id, "ins-1");
      assert.equal(draft.inspection.summary, "", "el borrador incompleto sobrevive la recarga");
      assert.equal(draft.findings.length, 1, "el hallazgo sobrevive la recarga");
      assert.equal((await reopened.listQueue(owner)).length, 2, "las intenciones sobreviven la recarga");
      reopened.close();
    }

    // A failing write rejects and leaves no partial state (no false success).
    {
      const storage = await LocalStorage.open("lc1-fail");
      harness.failNextPut("sync_queue", new Error("QuotaExceededError"));
      await assert.rejects(() => saveDraft(owner, storage, {
        owner,
        inspection: makeLocalInspection("ins-x"),
        findings: [],
        removedFindings: [],
      }));
      assert.equal(await storage.getInspection(owner, "ins-x"), null, "no queda entidad parcial");
      assert.equal((await storage.listQueue(owner)).length, 0, "no queda intención huérfana");
      storage.close();
    }

    // The authorized refresh merge preserves pending local state and tombstones.
    {
      const syncedLocal = { id: "a", location: "Lab A", date: "2026-09-30", summary: "local", syncStatus: "synced", inspector: "T", laboratoryCode: "L", workflowStatus: "draft", findingCount: 0, result: "without_findings" };
      const pendingLocal = { id: "b", location: "Lab B", date: "2026-09-29", summary: "edición pendiente", syncStatus: "pending", inspector: "T", laboratoryCode: "L2", workflowStatus: "draft", findingCount: 1, result: "requires_attention" };
      const remote = [
        { id: "a", location: "Lab A", date: "2026-09-30", summary: "versión remota", syncStatus: "synced", inspector: "T", laboratoryCode: "L", workflowStatus: "draft", findingCount: 0, result: "without_findings" },
        { id: "c", location: "Lab C", date: "2026-09-28", summary: "nueva remota", syncStatus: "synced", inspector: "T", laboratoryCode: "L3", workflowStatus: "completed", findingCount: 2, result: "requires_attention" },
        { id: "d", location: "Lab D", date: "2026-09-27", summary: "descartada", syncStatus: "synced", inspector: "T", laboratoryCode: "L4", workflowStatus: "draft", findingCount: 0, result: "without_findings" },
      ];
      const merged = mergeRemoteRefresh([syncedLocal, pendingLocal], remote, new Set(["d"]));
      assert.equal(merged.find((item) => item.id === "a").summary, "versión remota", "lo sincronizado aplica la versión remota");
      assert.equal(merged.find((item) => item.id === "b").summary, "edición pendiente", "la edición pendiente no se pisa");
      assert.ok(merged.some((item) => item.id === "c"), "se añaden inspecciones remotas nuevas");
      assert.ok(!merged.some((item) => item.id === "d"), "el descarte no reaparece tras el refresco");
    }

    // Finalize creates a pending finalize intent ordered after the capture; never remote completed.
    {
      const storage = await LocalStorage.open("lc3");
      const finding = makeLocalFinding("fin-3", "ins-3");
      const finalizeIntent = await finalizeDraft(owner, storage, {
        owner,
        inspection: makeLocalInspection("ins-3"),
        findings: [finding],
        removedFindings: [],
        expectedFindingIds: ["fin-3"],
      });
      assert.equal(finalizeIntent.operation, "inspection.finalize");
      const queue = await storage.listQueue(owner);
      assert.equal(queue.length, 3, "captura + finalize");
      assert.equal(queue[queue.length - 1].operation, "inspection.finalize", "finalize ordenado al final");
      assert.deepEqual(queue[queue.length - 1].dependsOn, [queue[0].operationId, queue[1].operationId], "depende de la captura");
      assert.equal(await hasPendingFinalization(owner, storage, "ins-3"), true);
      const local = await storage.getInspection(owner, "ins-3");
      assert.equal(local.syncStatus, "pending", "finalización pendiente, no completed remoto");
      assert.equal(local.workflowStatus, "draft");
      storage.close();
    }

    // Detail-style finalize (no capture) still enqueues a pending intent.
    {
      const storage = await LocalStorage.open("lc3b");
      await storage.saveInspection(owner, makeLocalInspection("ins-4", { baseVersion: 2 }));
      const intent = await enqueueFinalizeIntent(owner, storage, { inspectionId: "ins-4", baseVersion: 2, expectedFindingIds: [] });
      assert.equal(intent.operation, "inspection.finalize");
      assert.equal(await hasPendingFinalization(owner, storage, "ins-4"), true);
      assert.equal((await storage.getInspection(owner, "ins-4")).syncStatus, "pending");
      storage.close();
    }

    // Discard of a never-sent draft removes entity, findings and intents atomically.
    {
      const storage = await LocalStorage.open("lc4");
      await saveDraft(owner, storage, {
        owner,
        inspection: makeLocalInspection("ins-5"),
        findings: [makeLocalFinding("fin-5", "ins-5")],
        removedFindings: [],
      });
      await discardDraft(owner, storage, "ins-5");
      assert.equal(await storage.getInspection(owner, "ins-5"), null, "la entidad desaparece");
      assert.equal((await storage.listFindings(owner, "ins-5")).length, 0, "sin hallazgos huérfanos");
      assert.equal((await storage.listQueue(owner)).length, 0, "sin intenciones huérfanas");
      storage.close();
    }

    // Discard of a sent inspection keeps the tombstone and an ordered discard intent.
    {
      const storage = await LocalStorage.open("lc4b");
      await storage.saveInspection(owner, makeLocalInspection("ins-6", { baseVersion: 3 }));
      await storage.enqueue(owner, makeIntent("op-create", "ins-6", "inspection.create", null, 1));
      await discardDraft(owner, storage, "ins-6");
      const tombstone = await storage.getInspection(owner, "ins-6");
      assert.notEqual(tombstone.deletedAt, null, "se conserva la identidad y el tombstone");
      assert.equal(tombstone.syncStatus, "pending");
      const queue = await storage.listQueue(owner);
      assert.equal(queue.length, 2, "intención previa + descarte ordenado");
      assert.equal(queue[queue.length - 1].operation, "inspection.discard");
      assert.equal(queue[queue.length - 1].baseVersion, 3);
      storage.close();
    }

    console.log("local-capture.spec.ts: PASS");
  } finally {
    globalThis.indexedDB = originalIndexedDb;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });