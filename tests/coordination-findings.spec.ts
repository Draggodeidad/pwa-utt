const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { ApiClientError } = require("../src/lib/api/client.ts");
const { saveCoordinationFollowup, validFollowup } = require("../src/features/findings/services/coordination-followup.ts");
const { runQueue } = require("../src/lib/pwa/sync/runner.ts");
const { resolveConflict } = require("../src/features/sync/services/resolve-conflict.ts");

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const INSPECTION = "33333333-3333-4333-8333-333333333333";
const FINDING = "44444444-4444-4444-8444-444444444444";
const TIME = "2026-10-01T10:00:00.000Z";

function finding(version = 1, status = "pending", priority = "medium") {
  return {
    id: FINDING, inspectionId: INSPECTION, folio: "INS-42", folioNumber: 42,
    location: "Laboratorio A", laboratoryCode: "A", inspectionDate: "2026-10-01", date: "2026-10-01",
    technician: "Técnico", title: "Cable", description: "Revisar cable", createdBy: OWNER_A, priority, status,
    workflowStatus: "completed", version, createdAt: TIME, updatedAt: TIME, resolvedAt: null,
  };
}

async function main() {
  globalThis.indexedDB = createIndexedDbHarness().indexedDB;
  globalThis.window = new EventTarget();
  assert.equal(validFollowup("pending", "in_review"), true);
  assert.equal(validFollowup("in_review", "resolved"), true);
  assert.equal(validFollowup("pending", "resolved"), false);
  assert.equal(validFollowup("resolved", "in_review"), false);

  const a = await LocalStorage.open("coord-a");
  const b = await LocalStorage.open("coord-b");
  await assert.rejects(saveCoordinationFollowup(a, OWNER_A, { ...finding(), workflowStatus: "draft" }, "high", "pending"));
  await assert.rejects(saveCoordinationFollowup(a, OWNER_A, finding(), "medium", "resolved"));
  assert.equal((await a.listQueue(OWNER_A)).length, 0);

  const first = await saveCoordinationFollowup(a, OWNER_A, finding(), "high", "pending");
  const second = await saveCoordinationFollowup(b, OWNER_B, finding(), "low", "in_review");
  assert.equal(first.operation, "finding.followup");
  assert.deepEqual(first.payload, { priority: "high" });
  assert.deepEqual(second.payload, { priority: "low", status: "in_review" });
  assert.equal((await a.getFinding(OWNER_A, FINDING)).syncStatus, "pending");
  a.close();

  const reopened = await LocalStorage.open("coord-a");
  assert.equal((await reopened.listQueue(OWNER_A)).length, 1, "la intención sobrevive recarga");
  const server = { version: 1, status: "pending", priority: "medium" };
  const client = {
    get: async () => finding(server.version, server.status, server.priority),
    patch: async (_path, body, options) => {
      if (body.baseVersion !== server.version) throw new ApiClientError(409, { code: "VERSION_CONFLICT", message: "Versión antigua" });
      server.priority = body.payload.priority ?? server.priority;
      server.status = body.payload.status ?? server.status;
      server.version++;
      return { operationId: options.operationId, entityId: FINDING, entityType: "finding", version: server.version, appliedAt: TIME, replayed: false };
    },
  };
  assert.equal((await runQueue(reopened, OWNER_A, { client, verifyOwner: async () => true })).acknowledged, 1);
  assert.equal(server.version, 2);
  assert.equal((await reopened.getFinding(OWNER_A, FINDING)).syncStatus, "synced");
  assert.equal((await reopened.listQueue(OWNER_A)).length, 0);
  reopened.close();
  const afterAck = await LocalStorage.open("coord-a");
  assert.equal((await afterAck.getFinding(OWNER_A, FINDING)).version, 2, "ACK y versión sobreviven recarga");

  assert.equal((await runQueue(b, OWNER_B, { client, verifyOwner: async () => true })).failed, 1);
  const conflict = await b.getConflict(OWNER_B, second.operationId);
  assert.equal(conflict.reason, "version");
  assert.equal(conflict.remoteVersion, 2);
  assert.equal(conflict.localSnapshot.entity.status, "in_review");
  assert.equal(conflict.remoteSnapshot.priority, "high");
  assert.equal((await b.listQueue(OWNER_B)).length, 1, "el conflicto conserva la operación");
  await resolveConflict({ storage: b, client, owner: OWNER_B, verifyOwner: async () => "coordinator" }, second.operationId, "mine");
  assert.equal((await runQueue(b, OWNER_B, { client, verifyOwner: async () => true })).acknowledged, 1);
  assert.equal(server.version, 3);
  assert.equal(server.status, "in_review");
  assert.equal((await b.listQueue(OWNER_B)).length, 0);
  assert.ok((await b.getConflict(OWNER_B, second.operationId)).resolvedAt);

  const finalStep = await saveCoordinationFollowup(b, OWNER_B, finding(3, "in_review", "low"), "low", "resolved");
  assert.deepEqual(finalStep.payload, { status: "resolved" });
  assert.equal((await runQueue(b, OWNER_B, { client, verifyOwner: async () => true })).acknowledged, 1);
  assert.equal(server.status, "resolved");
  assert.equal((await b.getFinding(OWNER_B, FINDING)).version, 4);

  await assert.rejects(saveCoordinationFollowup(b, OWNER_B, finding(3, "resolved", "low"), "low", "in_review"));
  afterAck.close();
  b.close();
  console.log("PASS coordination findings: durable follow-up, ACK, conflict recovery and transitions");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
