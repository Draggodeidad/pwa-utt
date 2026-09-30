const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { saveDraft, finalizeDraft } = require("../src/features/inspections/services/local-capture.ts");
const { operationRoute, runQueue, sendOperation } = require("../src/lib/pwa/sync/runner.ts");

const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
const inspectionId = "33333333-3333-4333-8333-333333333333";
const findingId = "44444444-4444-4444-8444-444444444444";

function inspection(owner, extra = {}) {
  return {
    id: inspectionId, folioNumber: 0, laboratoryId: null, inspectorId: owner,
    inspectionDate: "2026-09-30", summary: "Primera", workflowStatus: "draft", updatedBy: owner,
    createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z", version: 0,
    completedAt: null, deletedAt: null, ownerUserId: owner, localRevision: 1,
    baseVersion: null, syncStatus: "local", localUpdatedAt: "2026-09-30T00:00:00Z", ...extra,
  };
}
function finding(owner) {
  return {
    id: findingId, inspectionId, title: "Cableado", description: "Revisión", priority: "medium",
    status: "pending", createdBy: owner, updatedBy: owner, createdAt: "2026-09-30T00:00:00Z",
    updatedAt: "2026-09-30T00:00:00Z", version: 0, resolvedAt: null, deletedAt: null,
    ownerUserId: owner, localRevision: 1, baseVersion: null, syncStatus: "local",
    localUpdatedAt: "2026-09-30T00:00:00Z",
  };
}
function fakeClient(send) {
  return {
    post: (path, body, options) => send("post", path, body, options.operationId),
    put: (path, body, options) => send("put", path, body, options.operationId),
    patch: (path, body, options) => send("patch", path, body, options.operationId),
    delete: (path, options) => send("delete", path, options.body, options.operationId),
  };
}

async function main() {
  const harness = createIndexedDbHarness();
  const original = globalThis.indexedDB;
  globalThis.indexedDB = harness.indexedDB;
  try {
    const methods = [
      ["inspection.create", "put", `/api/inspections/${inspectionId}`],
      ["inspection.update", "patch", `/api/inspections/${inspectionId}`],
      ["inspection.discard", "delete", `/api/inspections/${inspectionId}`],
      ["inspection.finalize", "post", `/api/inspections/${inspectionId}/finalize`],
      ["finding.create", "put", `/api/findings/${inspectionId}`],
      ["finding.update", "patch", `/api/findings/${inspectionId}`],
      ["finding.delete", "delete", `/api/findings/${inspectionId}`],
      ["finding.followup", "patch", `/api/findings/${inspectionId}/follow-up`],
    ];
    for (const [kind, method, path] of methods) assert.deepEqual(operationRoute(kind, inspectionId), { method, path });
    const mapped = [];
    const mappingClient = fakeClient(async (method, path, body, key) => {
      mapped.push({ method, path, body, key });
      return { operationId: key, entityId: body.entityId, entityType: body.kind.startsWith("inspection") ? "inspection" : "finding", version: 1, appliedAt: "2026-09-30T01:00:00Z", replayed: false };
    });
    for (const [kind] of methods) {
      const key = crypto.randomUUID();
      const body = { clientId: ownerA, kind, entityId: inspectionId, baseVersion: kind.endsWith("create") ? null : 7, payload: {} };
      await sendOperation(mappingClient, { operationId: key, entityId: inspectionId, frozenRequest: body });
      assert.equal(mapped.at(-1).key, key, "Idempotency-Key is stable for every mapping");
      assert.deepEqual(mapped.at(-1).body, body);
    }
    assert.deepEqual(mapped.map(({ method, path }) => [method, path]), methods.map(([, method, path]) => [method, path]));

    // Lost response: replay uses one stable key/body and leaves one remote entity.
    {
      const storage = await LocalStorage.open("lost-ack");
      await saveDraft(ownerA, storage, { owner: ownerA, inspection: inspection(ownerA), findings: [], removedFindings: [] });
      const seen = new Map();
      const calls = [];
      let loseFirst = true;
      const client = fakeClient(async (method, path, body, key) => {
        calls.push({ method, path, body: structuredClone(body), key });
        if (!seen.has(key)) seen.set(key, { operationId: key, entityId: body.entityId, entityType: "inspection", version: 1, appliedAt: "2026-09-30T01:00:00Z", replayed: false });
        if (loseFirst) { loseFirst = false; throw new Error("lost ACK"); }
        return { ...seen.get(key), replayed: true };
      });
      assert.deepEqual(await runQueue(storage, ownerB, { client, verifyOwner: async () => false }), { acknowledged: 0, failed: 0, paused: true });
      assert.equal(calls.length, 0, "B cannot send A's pending operation");
      let time = Date.now();
      const transport = { client, verifyOwner: async (owner) => owner === ownerA, now: () => time };
      assert.equal((await runQueue(storage, ownerA, transport)).failed, 1);
      const afterLost = (await storage.listQueue(ownerA))[0];
      assert.equal(afterLost.status, "error");
      assert.ok(afterLost.frozenRequest, "request survives lost ACK");
      assert.equal((await runQueue(storage, ownerA, transport)).acknowledged, 0, "retry waits for its scheduled time");
      time = Date.parse(afterLost.nextAttemptAt);
      assert.equal((await runQueue(storage, ownerA, transport)).acknowledged, 1);
      assert.equal(seen.size, 1, "receipt replay does not duplicate entity");
      assert.deepEqual(calls[0], calls[1], "key, clientId, payload and baseVersion are identical");
      assert.equal((await storage.listQueue(ownerA)).length, 0);
      assert.equal((await storage.getInspection(ownerA, inspectionId)).baseVersion, 1);
      storage.close();
    }

    // Parent ACK precedes finding ACK; finalization sees the parent's version and exact finding set.
    {
      const storage = await LocalStorage.open("ordered");
      await finalizeDraft(ownerA, storage, {
        owner: ownerA, inspection: inspection(ownerA), findings: [finding(ownerA)],
        removedFindings: [], expectedFindingIds: [findingId],
      });
      const sent = [];
      const client = fakeClient(async (method, path, body, key) => {
        sent.push({ method, path, body, key });
        return { operationId: key, entityId: body.entityId, entityType: body.kind.startsWith("inspection") ? "inspection" : "finding",
          version: body.kind === "inspection.finalize" ? 2 : 1, appliedAt: "2026-09-30T01:00:00Z", replayed: false,
          ...(body.kind === "inspection.create" ? { folioNumber: 27 } : {}) };
      });
      const result = await runQueue(storage, ownerA, { client, verifyOwner: async () => true });
      assert.deepEqual(result, { acknowledged: 3, failed: 0, paused: false });
      assert.deepEqual(sent.map((call) => call.body.kind), ["inspection.create", "finding.create", "inspection.finalize"]);
      assert.equal(sent[0].body.baseVersion, null);
      assert.equal(sent[1].body.baseVersion, null);
      assert.equal(sent[1].body.payload.inspectionId, inspectionId);
      assert.equal(sent[2].body.baseVersion, 1);
      assert.deepEqual(sent[2].body.payload.expectedFindingIds, [findingId]);
      assert.equal((await storage.getInspection(ownerA, inspectionId)).workflowStatus, "completed");
      assert.equal((await storage.getInspection(ownerA, inspectionId)).folioNumber, 27);
      storage.close();
    }

    // An edit after first send gets a new operation; old ACK preserves it and chains version.
    {
      const storage = await LocalStorage.open("edit-during-send");
      await saveDraft(ownerA, storage, { owner: ownerA, inspection: inspection(ownerA), findings: [], removedFindings: [] });
      const first = (await storage.listQueue(ownerA))[0];
      const sent = await storage.prepareSend(ownerA, first.operationId, await storage.getClientId());
      await saveDraft(ownerA, storage, { owner: ownerA, inspection: inspection(ownerA, { summary: "Segunda", localRevision: 2 }), findings: [], removedFindings: [] });
      const ack = { operationId: first.operationId, entityId: inspectionId, entityType: "inspection", version: 1, appliedAt: "2026-09-30T01:00:00Z", replayed: false };
      await storage.acknowledge(ownerA, sent, ack);
      const local = await storage.getInspection(ownerA, inspectionId);
      const pending = await storage.listQueue(ownerA);
      assert.equal(local.summary, "Segunda");
      assert.equal(local.syncStatus, "pending");
      assert.equal(local.baseVersion, 1);
      assert.equal(pending.length, 1);
      assert.equal(pending[0].operation, "inspection.update");
      assert.notEqual(pending[0].operationId, first.operationId);
      assert.equal(pending[0].baseVersion, 1);
      assert.equal(pending[0].frozenRequest, undefined);
      storage.close();
    }

    // ACK transaction failure rolls back entity version and queue removal together.
    {
      const storage = await LocalStorage.open("ack-rollback");
      await saveDraft(ownerA, storage, { owner: ownerA, inspection: inspection(ownerA), findings: [], removedFindings: [] });
      const item = (await storage.listQueue(ownerA))[0];
      const sent = await storage.prepareSend(ownerA, item.operationId, await storage.getClientId());
      harness.failNextPut("inspection_local", new Error("QuotaExceededError"));
      await assert.rejects(() => storage.acknowledge(ownerA, sent, {
        operationId: item.operationId, entityId: inspectionId, entityType: "inspection", version: 1,
        appliedAt: "2026-09-30T01:00:00Z", replayed: false,
      }));
      assert.equal((await storage.getInspection(ownerA, inspectionId)).baseVersion, null);
      assert.equal((await storage.listQueue(ownerA)).length, 1);
      storage.close();
    }

    // A failed parent leaves its child queued while an independent inspection proceeds.
    {
      const storage = await LocalStorage.open("independent");
      const otherId = "55555555-5555-4555-8555-555555555555";
      await saveDraft(ownerA, storage, {
        owner: ownerA, inspection: inspection(ownerA), findings: [finding(ownerA)], removedFindings: [],
      });
      await saveDraft(ownerA, storage, {
        owner: ownerA, inspection: inspection(ownerA, { id: otherId }), findings: [], removedFindings: [],
      });
      const sent = [];
      const client = fakeClient(async (_method, _path, body, key) => {
        sent.push(body.entityId);
        if (body.entityId === inspectionId) throw new Error("server unavailable");
        return { operationId: key, entityId: body.entityId, entityType: "inspection", version: 1, appliedAt: "2026-09-30T01:00:00Z", replayed: false };
      });
      const result = await runQueue(storage, ownerA, { client, verifyOwner: async () => true });
      assert.deepEqual(result, { acknowledged: 1, failed: 1, paused: false });
      assert.deepEqual(sent, [inspectionId, otherId]);
      assert.equal((await storage.listQueue(ownerA)).length, 2, "failed parent and dependent finding remain");
      storage.close();
    }

    // If the verified account changes before ACK, keep the frozen operation for its owner.
    {
      const storage = await LocalStorage.open("session-switch");
      await saveDraft(ownerA, storage, { owner: ownerA, inspection: inspection(ownerA), findings: [], removedFindings: [] });
      let checks = 0;
      const client = fakeClient(async (_method, _path, body, key) => ({
        operationId: key, entityId: body.entityId, entityType: "inspection", version: 1,
        appliedAt: "2026-09-30T01:00:00Z", replayed: false,
      }));
      const result = await runQueue(storage, ownerA, { client, verifyOwner: async () => ++checks < 3 });
      assert.deepEqual(result, { acknowledged: 0, failed: 0, paused: true });
      const pending = (await storage.listQueue(ownerA))[0];
      assert.ok(pending.frozenRequest);
      assert.equal((await storage.getInspection(ownerA, inspectionId)).baseVersion, null);
      assert.equal((await storage.listQueue(ownerB)).length, 0);
      assert.equal((await runQueue(storage, ownerA, { client, verifyOwner: async () => true })).acknowledged, 1);
      storage.close();
    }

    // Removing a new finding cancels an unsent create; a sent create gains a dependent delete.
    {
      const storage = await LocalStorage.open("remove-new-finding");
      await saveDraft(ownerA, storage, { owner: ownerA, inspection: inspection(ownerA), findings: [finding(ownerA)], removedFindings: [] });
      await saveDraft(ownerA, storage, {
        owner: ownerA, inspection: inspection(ownerA, { localRevision: 2 }), findings: [],
        removedFindings: [{ id: findingId, baseVersion: null }],
      });
      assert.equal((await storage.listQueue(ownerA)).filter((item) => item.entityId === findingId).length, 0);
      assert.equal(await storage.getFinding(ownerA, findingId), null);
      storage.close();
    }
    {
      const storage = await LocalStorage.open("remove-sent-finding");
      await storage.saveInspection(ownerA, inspection(ownerA, { baseVersion: 1, version: 1 }));
      await saveDraft(ownerA, storage, { owner: ownerA, inspection: inspection(ownerA, { baseVersion: 1, version: 1 }), findings: [finding(ownerA)], removedFindings: [] });
      const create = (await storage.listQueue(ownerA)).find((item) => item.entityId === findingId);
      const sent = await storage.prepareSend(ownerA, create.operationId, await storage.getClientId());
      await saveDraft(ownerA, storage, {
        owner: ownerA, inspection: inspection(ownerA, { baseVersion: 1, version: 1, localRevision: 2 }), findings: [],
        removedFindings: [{ id: findingId, baseVersion: null }],
      });
      const deleteIntent = (await storage.listQueue(ownerA)).find((item) => item.operation === "finding.delete");
      assert.ok(deleteIntent.dependsOn.includes(create.operationId));
      await storage.acknowledge(ownerA, sent, {
        operationId: create.operationId, entityId: findingId, entityType: "finding", version: 1,
        appliedAt: "2026-09-30T01:00:00Z", replayed: false,
      });
      assert.equal((await storage.listQueue(ownerA)).find((item) => item.operation === "finding.delete").baseVersion, 1);
      storage.close();
    }
    console.log("queue-transport.spec.ts: PASS");
  } finally {
    globalThis.indexedDB = original;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
