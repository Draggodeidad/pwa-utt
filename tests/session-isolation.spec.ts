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
  const globals = ["indexedDB", "localStorage", "window", "document", "location"];
  const previous = Object.fromEntries(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const connections = [];
  let release, inFlight;
  const open = async () => {
    const store = await LocalStorage.open("isolation");
    connections.push(store);
    return store;
  };
  const fakeStorage = memoryStorage();
  const harness = createIndexedDbHarness();
  globalThis.indexedDB = harness.indexedDB;
  globalThis.localStorage = fakeStorage;
  globalThis.window = new EventTarget();
  globalThis.location = { protocol: "https:" };
  globalThis.document = { cookie: "" };
  try {
    session.establishLocalSession({ userId: A, displayName: "A" });
    assert.equal(session.readLocalSession().userId, A);
    const firstEpoch = session.sessionEpoch();
    const stale = await open();
    const peer = await open();
    await saveDraft(A, stale, { owner: A, inspection: draft(), findings: [], removedFindings: [] });
    const own = await stale.listInspections(A);
    assert.equal(own.length, 1);
    assert.equal(own[0].id, ID);
    assert.equal(own[0].summary, "A pendiente");
    const queued = await stale.listQueue(A);
    assert.equal(queued.length, 1);
    let sending = false;
    const pendingAck = new Promise((resolve) => { release = resolve; });
    const transport = { verifyOwner: async (owner) => session.isSessionCurrent(firstEpoch, owner),
      client: { put: async () => { sending = true; return pendingAck; } } };
    inFlight = runQueue(stale, A, transport);
    for (let attempt = 0; !sending && attempt < 200; attempt++) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(sending, true, "A must have a request in flight before logout");
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
    assert.equal(session.readLocalSession().userId, B);
    const bStore = await open();
    assert.deepEqual(await bStore.listInspections(B), []);
    assert.deepEqual(await bStore.listQueue(B), []);
    assert.equal(await bStore.getInspection(B, ID), null);
    await assert.rejects(() => bStore.listInspections(A), PartitionRequiredError);
    assert.equal(session.isSessionCurrent(firstEpoch, A), false);
    await assert.rejects(() => bStore.listQueue(A), PartitionRequiredError);
    release({ operationId: queued[0].operationId, entityId: ID,
      entityType: "inspection", version: 1, appliedAt: time, folioNumber: 10 });
    assert.equal((await inFlight).paused, true);
    await assert.rejects(() => stale.listQueue(A), PartitionRequiredError);
    session.establishLocalSession({ userId: A, displayName: "A again" });
    const restored = await open();
    assert.equal((await restored.listInspections(A)).length, 1);
    const preserved = await restored.listQueue(A);
    assert.equal(preserved.length, 1);
    assert.equal(preserved[0].operationId, queued[0].operationId, "late ACK cannot remove pending work");
    assert.equal((await restored.listInspections(A))[0].version, 0, "late ACK cannot update A's entity");
    assert.equal(await restored.leaseExpiresAt(A), null);
    assert.equal(session.isSessionCurrent(firstEpoch, A), false, "same account cannot revive stale work");
    await assert.rejects(() => peer.listQueue(A), PartitionRequiredError, "old tab stays fenced after A logs in again");
    assert.equal(fakeStorage.entries().some(([key, value]) => /password|access.token|refresh.token/i.test(`${key} ${value}`)), false);
    assert.doesNotMatch(JSON.stringify(harness.snapshot("isolation")), /password|access.token|refresh.token/i, "IndexedDB contains no credentials");
    session.blockLocalSession();
    assert.equal(session.isRemoteLogoutPending(), true);
    session.establishLocalSession({ userId: B, displayName: "B again" });
    assert.equal(session.isRemoteLogoutPending(), false, "validated online login supersedes failed remote logout");
    console.log("session-isolation.spec.ts: PASS");
  } finally {
    // Release synthetic transport even when an assertion fails before the ACK.
    if (release) release({ operationId: "cleanup", entityId: ID, entityType: "inspection", version: 1, appliedAt: time });
    try { if (inFlight) await inFlight; }
    finally {
      for (const store of connections) store.close();
      for (const key of globals) {
        if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
        else delete globalThis[key];
      }
    }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
