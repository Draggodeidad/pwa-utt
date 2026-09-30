const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage, PartitionRequiredError } = require("../src/lib/pwa/offline-storage.ts");
const { saveDraft } = require("../src/features/inspections/services/local-capture.ts");
const { runQueue } = require("../src/lib/pwa/sync/runner.ts");
const session = require("../src/lib/pwa/offline-session.ts");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const time = "2026-09-30T01:00:00Z";
function draft() {
  return { id: ID, folioNumber: 0, laboratoryId: null, inspectorId: A,
    inspectionDate: "2026-09-30", summary: "A pendiente", workflowStatus: "draft", updatedBy: A,
    createdAt: time, updatedAt: time, version: 0, completedAt: null, deletedAt: null,
    ownerUserId: A, localRevision: 1, baseVersion: null, syncStatus: "local", localUpdatedAt: time };
}
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); }, entries: () => [...values.entries()] };
}
async function main() {
  const previous = { indexedDB: globalThis.indexedDB, localStorage: globalThis.localStorage, window: globalThis.window, document: globalThis.document, location: globalThis.location };
  const fakeStorage = memoryStorage();
  const harness = createIndexedDbHarness();
  globalThis.indexedDB = harness.indexedDB;
  globalThis.localStorage = fakeStorage;
  globalThis.window = new EventTarget();
  globalThis.location = { protocol: "https:" };
  globalThis.document = { cookie: "" };
  try {
    session.establishLocalSession({ userId: A, displayName: "A" });
    const firstEpoch = session.sessionEpoch();
    const stale = await LocalStorage.open("isolation");
    const peer = await LocalStorage.open("isolation");
    await saveDraft(A, stale, { owner: A, inspection: draft(), findings: [], removedFindings: [] });
    const queued = await stale.listQueue(A);
    assert.equal(queued.length, 1);
    let release;
    let sending = false;
    const pendingAck = new Promise((resolve) => { release = resolve; });
    const transport = { verifyOwner: async (owner) => session.isSessionCurrent(firstEpoch, owner),
      client: { put: async () => { sending = true; return pendingAck; } } };
    const inFlight = runQueue(stale, A, transport);
    while (!sending) await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(session.blockLocalSession(), A);
    await LocalStorage.revokeLease(A, session.sessionEpoch(), "isolation");
    assert.equal(session.readLocalSession(), null);
    assert.equal(session.isRemoteLogoutPending(), true);
    assert.equal(session.isSessionCurrent(firstEpoch, A), false);
    assert.match(globalThis.document.cookie, /pwa-utt-logout-blocked=1/);
    await assert.rejects(() => LocalStorage.open("isolation"), PartitionRequiredError);
    await assert.rejects(() => stale.listInspections(A), PartitionRequiredError);
    await assert.rejects(() => peer.listInspections(A), PartitionRequiredError, "second tab loses access");
    session.completeRemoteLogout(session.sessionEpoch());
    assert.equal(session.isSessionBlocked(), true);
    assert.equal(session.isRemoteLogoutPending(), false);
    session.establishLocalSession({ userId: B, displayName: "B" });
    const bStore = await LocalStorage.open("isolation");
    assert.deepEqual(await bStore.listInspections(B), []);
    assert.deepEqual(await bStore.listQueue(B), []);
    assert.equal(session.isSessionCurrent(firstEpoch, A), false);
    await assert.rejects(() => bStore.listQueue(A), PartitionRequiredError);
    release({ operationId: queued[0].operationId, entityId: ID,
      entityType: "inspection", version: 1, appliedAt: time, folioNumber: 10 });
    assert.equal((await inFlight).paused, true);
    await assert.rejects(() => stale.listQueue(A), PartitionRequiredError);
    bStore.close();
    session.establishLocalSession({ userId: A, displayName: "A again" });
    const restored = await LocalStorage.open("isolation");
    assert.equal((await restored.listInspections(A)).length, 1);
    assert.equal((await restored.listQueue(A)).length, 1);
    assert.equal(await restored.leaseExpiresAt(A), null);
    assert.equal(session.isSessionCurrent(firstEpoch, A), false, "same account cannot revive stale work");
    await assert.rejects(() => peer.listQueue(A), PartitionRequiredError, "old tab stays fenced after A logs in again");
    assert.equal(fakeStorage.entries().some(([key, value]) => /password|access.token|refresh.token/i.test(`${key} ${value}`)), false);
    assert.doesNotMatch(JSON.stringify(harness.snapshot("isolation")), /password|access.token|refresh.token/i, "IndexedDB contains no credentials");
    session.blockLocalSession();
    assert.equal(session.isRemoteLogoutPending(), true);
    session.establishLocalSession({ userId: B, displayName: "B again" });
    assert.equal(session.isRemoteLogoutPending(), false, "validated online login supersedes failed remote logout");
    restored.close(); stale.close(); peer.close();
    console.log("session-isolation.spec.ts: PASS");
  } finally { Object.assign(globalThis, previous); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
