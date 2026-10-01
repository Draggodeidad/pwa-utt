const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { ApiClientError } = require("../src/lib/api/client.ts");
const { createIntent } = require("../src/features/inspections/services/local-capture.ts");
const { runQueue } = require("../src/lib/pwa/sync/runner.ts");
const { resolveConflict } = require("../src/features/sync/services/resolve-conflict.ts");

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const inspectionId = "33333333-3333-4333-8333-333333333333";
const findingId = "44444444-4444-4444-8444-444444444444";
const time = "2026-09-30T01:00:00.000Z";

function inspection(summary = "Mi captura") {
  return {
    id: inspectionId, folioNumber: 7, laboratoryId: null, inspectorId: owner,
    inspectionDate: "2026-09-30", summary, workflowStatus: "draft", updatedBy: owner,
    createdAt: time, updatedAt: time, version: 1, completedAt: null, deletedAt: null,
    ownerUserId: owner, localRevision: 1, baseVersion: 1, syncStatus: "pending", localUpdatedAt: time,
  };
}

function finding() {
  return {
    id: findingId, inspectionId, title: "Cable local", description: "Captura de campo", priority: "high", status: "in_review",
    createdBy: owner, updatedBy: owner, createdAt: time, updatedAt: time, version: 1,
    resolvedAt: time, deletedAt: null, ownerUserId: owner, localRevision: 1,
    baseVersion: 1, syncStatus: "pending", localUpdatedAt: time,
  };
}

function remoteInspection(status = "draft", version = 2) {
  return { id: inspectionId, folio: "INS-7", folioNumber: 7, location: "Laboratorio", laboratoryId: null,
    laboratoryCode: "—", inspectionDate: "2026-09-30", date: "2026-09-30", technician: "Técnico",
    workflowStatus: status, result: "without_findings", syncStatus: "synced", scope: "Versión servidor", findings: [], version };
}

function intent(operation = "inspection.update", dependsOn = [], localOrder = 1) {
  return createIntent({ owner, entity: "inspection", entityId: inspectionId, operation,
    payload: { summary: "Mi captura" }, baseVersion: 1, dependsOn, localOrder });
}

function failingClient(code, status, remote, metrics) {
  const fail = async () => { metrics.sends++; throw new ApiClientError(status, { code, message: "Conflicto", remoteSnapshot: { secret: "never trust this" } }); };
  return {
    get: async () => { metrics.gets++; return remote; },
    post: fail, put: fail, patch: fail, delete: fail,
  };
}

function context(storage, client, role = "technician") {
  return { storage, client, owner, verifyOwner: async (expected) => expected === owner ? role : null };
}

async function main() {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = createIndexedDbHarness().indexedDB;
  try {
    // Concurrent edits retain both copies and the frozen request across reopening.
    {
      let storage = await LocalStorage.open("version");
      await storage.saveInspection(owner, inspection());
      const failed = intent();
      const dependent = intent("inspection.update", [failed.operationId], 2);
      await storage.enqueue(owner, failed);
      await storage.enqueue(owner, dependent);
      const metrics = { sends: 0, gets: 0 };
      const client = failingClient("VERSION_CONFLICT", 409, remoteInspection(), metrics);
      assert.equal((await runQueue(storage, owner, { client, verifyOwner: async () => true })).failed, 1);
      storage.close();
      storage = await LocalStorage.open("version");
      const conflict = await storage.getConflict(owner, failed.operationId);
      assert.equal(conflict.reason, "version");
      assert.equal(conflict.localSnapshot.inspection.summary, "Mi captura");
      assert.equal(conflict.remoteSnapshot.scope, "Versión servidor");
      assert.equal(conflict.localVersion, 1);
      assert.equal(conflict.remoteVersion, 2);
      assert.equal(conflict.failedOperation.frozenRequest.kind, "inspection.update");
      assert.equal((await storage.getConflict(other, failed.operationId)), null);
      await resolveConflict(context(storage, client), failed.operationId, "mine");
      const queue = await storage.listQueue(owner);
      assert.equal(queue.length, 2);
      const reapplied = queue.find((item) => item.localOrder === 1);
      assert.notEqual(reapplied.operationId, failed.operationId);
      assert.equal(reapplied.baseVersion, 2);
      assert.equal(reapplied.payload.summary, "Mi captura");
      assert.deepEqual(queue.find((item) => item.localOrder === 2).dependsOn, [reapplied.operationId]);
      assert.equal((await storage.getConflict(owner, failed.operationId)).localSnapshot.inspection.summary, "Mi captura");
      assert.equal((await runQueue(storage, owner, { client, verifyOwner: async () => true })).failed, 1);
      assert.equal((await storage.getConflict(owner, reapplied.operationId)).remoteVersion, 2, "new operation can conflict again");
      assert.equal((await storage.listConflicts(owner)).length, 2);
      storage.close();
    }

    // A finalized original becomes a new draft with new entity IDs and no remote follow-up/audit.
    {
      const storage = await LocalStorage.open("completed");
      await storage.saveInspection(owner, inspection());
      await storage.saveFinding(owner, finding());
      const failed = intent();
      await storage.enqueue(owner, failed);
      const metrics = { sends: 0, gets: 0 };
      const client = failingClient("VERSION_CONFLICT", 409, remoteInspection("completed", 3), metrics);
      await runQueue(storage, owner, { client, verifyOwner: async () => true });
      const conflict = await storage.getConflict(owner, failed.operationId);
      assert.equal(conflict.reason, "state");
      await assert.rejects(() => resolveConflict(context(storage, client, "coordinator"), failed.operationId, "mine"), /no puede crear/);
      assert.equal((await storage.listQueue(owner)).length, 1);
      const { newInspectionId } = await resolveConflict(context(storage, client), failed.operationId, "mine");
      assert.notEqual(newInspectionId, inspectionId);
      const fresh = await storage.getInspection(owner, newInspectionId);
      const copiedFindings = await storage.listFindings(owner, newInspectionId);
      assert.equal(fresh.workflowStatus, "draft");
      assert.equal(fresh.baseVersion, null);
      assert.equal(fresh.folioNumber, 0);
      assert.equal(copiedFindings.length, 1);
      assert.notEqual(copiedFindings[0].id, findingId);
      assert.equal(copiedFindings[0].status, "pending");
      assert.equal(copiedFindings[0].resolvedAt, null);
      assert.equal(copiedFindings[0].createdBy, owner);
      assert.equal((await storage.getInspection(owner, inspectionId)).summary, "Mi captura");
      assert.equal((await storage.getFinding(owner, findingId)).status, "in_review");
      const queue = await storage.listQueue(owner);
      assert.deepEqual(queue.map((item) => item.operation), ["inspection.create", "finding.create"]);
      assert.deepEqual(queue[1].dependsOn, [queue[0].operationId]);
      assert.equal(queue[1].payload.inspectionId, newInspectionId);
      storage.close();
    }

    // Server choice adopts the authorized version and keeps the original local copy recoverable.
    {
      const storage = await LocalStorage.open("server");
      await storage.saveInspection(owner, inspection());
      const failed = intent();
      const dependent = intent("inspection.update", [failed.operationId], 2);
      await storage.enqueue(owner, failed);
      await storage.enqueue(owner, dependent);
      const client = failingClient("VERSION_CONFLICT", 409, remoteInspection("draft", 4), { sends: 0, gets: 0 });
      await runQueue(storage, owner, { client, verifyOwner: async () => true });
      await resolveConflict(context(storage, client), failed.operationId, "server");
      assert.equal((await storage.getInspection(owner, inspectionId)).summary, "Versión servidor");
      assert.equal((await storage.getInspection(owner, inspectionId)).baseVersion, 4);
      assert.equal((await storage.getConflict(owner, failed.operationId)).localSnapshot.inspection.summary, "Mi captura");
      const queue = await storage.listQueue(owner);
      assert.equal(queue.length, 1);
      assert.deepEqual(queue[0].dependsOn, []);
      assert.equal(queue[0].baseVersion, 4);
      storage.close();
    }

    // A previously visible snapshot cannot authorize a decision after access is lost.
    {
      const storage = await LocalStorage.open("lost-access");
      await storage.saveInspection(owner, inspection());
      const failed = intent();
      await storage.enqueue(owner, failed);
      const client = failingClient("VERSION_CONFLICT", 409, remoteInspection(), { sends: 0, gets: 0 });
      await runQueue(storage, owner, { client, verifyOwner: async () => true });
      const denied = { ...client, get: async () => { throw new ApiClientError(404, { code: "NOT_FOUND", message: "No visible" }); } };
      await assert.rejects(() => resolveConflict(context(storage, denied), failed.operationId, "server"), /confirmar el estado remoto/);
      assert.equal((await storage.getConflict(owner, failed.operationId)).resolvedAt, null);
      assert.equal((await storage.listQueue(owner)).length, 1);
      storage.close();
    }

    // Follow-up on a completed inspection is a version conflict, not a completed-capture conflict.
    {
      const storage = await LocalStorage.open("followup");
      await storage.saveInspection(owner, inspection());
      await storage.saveFinding(owner, finding());
      const failed = createIntent({ owner, entity: "finding", entityId: findingId, parentEntityId: inspectionId,
        operation: "finding.followup", payload: { status: "resolved" }, baseVersion: 1, dependsOn: [], localOrder: 1 });
      await storage.enqueue(owner, failed);
      const remote = { id: findingId, inspectionId, title: "Cable remoto", description: "Revisión", priority: "high",
        status: "in_review", workflowStatus: "completed", version: 2, updatedAt: time, resolvedAt: null };
      const client = failingClient("VERSION_CONFLICT", 409, remote, { sends: 0, gets: 0 });
      await runQueue(storage, owner, { client, verifyOwner: async () => true });
      assert.equal((await storage.getConflict(owner, failed.operationId)).reason, "version");
      await resolveConflict(context(storage, client, "coordinator"), failed.operationId, "mine");
      const replacement = (await storage.listQueue(owner))[0];
      assert.equal(replacement.operation, "finding.followup");
      assert.equal(replacement.baseVersion, 2);
      assert.equal(replacement.payload.status, "resolved");
      assert.notEqual(replacement.operationId, failed.operationId);
      storage.close();
    }

    // Reused keys/UUIDs cannot overwrite data; denied reads never become remote evidence.
    for (const [code, status, name, reason] of [["IDEMPOTENCY_KEY_REUSED", 409, "key", "key_reused"], ["ENTITY_ID_REUSED", 409, "entity", "entity_reused"], ["FORBIDDEN", 403, "forbidden", "inaccessible"], ["NOT_FOUND", 404, "missing", "inaccessible"]]) {
      const storage = await LocalStorage.open(name);
      await storage.saveInspection(owner, inspection());
      const failed = intent();
      await storage.enqueue(owner, failed);
      const metrics = { sends: 0, gets: 0 };
      const client = failingClient(code, status, remoteInspection(), metrics);
      await runQueue(storage, owner, { client, verifyOwner: async () => true });
      const conflict = await storage.getConflict(owner, failed.operationId);
      assert.equal(conflict.remoteSnapshot, null);
      assert.equal(conflict.reason, reason);
      assert.equal(metrics.gets, 0);
      assert.equal((await storage.listQueue(owner))[0].lastError.remoteSnapshot, undefined);
      await assert.rejects(() => resolveConflict(context(storage, client), failed.operationId, "mine"), /requiere revisión/);
      assert.equal((await storage.getConflict(owner, failed.operationId)).localSnapshot.inspection.summary, "Mi captura");
      storage.close();
    }
    console.log("conflict-resolution.spec.ts: PASS");
  } finally { globalThis.indexedDB = previous; }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
