const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { localStoreSpecs } = require("../src/lib/pwa/indexed-db.ts");
const { saveDraft, enqueueFinalizeIntent, discardDraft } = require("../src/features/inspections/services/local-capture.ts");
const { createLocalPhoto } = require("../src/features/findings/services/photo.repository.ts");
const { runQueue } = require("../src/lib/pwa/sync/runner.ts");
const { ApiClientError } = require("../src/lib/api/client.ts");
const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const insp = "33333333-3333-4333-8333-333333333333", finding = "44444444-4444-4444-8444-444444444444";
const at = "2026-10-09T00:00:00.000Z";
function capture() {
  const metadata = { ownerUserId: owner, localRevision: 1, baseVersion: null, syncStatus: "local", localUpdatedAt: at, version: 0, createdAt: at, updatedAt: at, deletedAt: null };
  return { owner, inspection: { ...metadata, id: insp, folioNumber: 0, laboratoryId: null, inspectorId: owner, inspectionDate: "2026-10-09", summary: "Synthetic photo capture", workflowStatus: "draft", completedAt: null, updatedBy: owner }, findings: [{ ...metadata, id: finding, inspectionId: insp, title: "Synthetic finding", description: "Synthetic", priority: "medium", status: "pending", resolvedAt: null, createdBy: owner, updatedBy: owner }], removedFindings: [] };
}
async function photo(id = crypto.randomUUID()) { return createLocalPhoto({ id, owner, inspectionId: insp, findingId: finding, file: new Blob(["synthetic image bytes"], { type: "image/jpeg" }) }); }
async function main() {
  const harness = createIndexedDbHarness(), original = globalThis.indexedDB;
  globalThis.indexedDB = harness.indexedDB;
  try {
    // Open a real v2-shaped harness database, then upgrade without dropping the capture.
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("photo-upgrade", 2);
      request.onupgradeneeded = () => {
        for (const spec of localStoreSpecs.filter(spec => spec.name !== "photo_local")) {
          const store = request.result.createObjectStore(spec.name, { keyPath: spec.keyPath });
          for (const index of spec.indexes ?? []) store.createIndex(index.name, index.keyPath);
        }
        request.result.transaction(["inspection_local"], "readwrite").objectStore("inspection_local").put(capture().inspection);
      };
      request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = reject;
    });
    let storage = await LocalStorage.open("photo-upgrade");
    assert.equal((await storage.getInspection(owner, insp)).summary, "Synthetic photo capture");
    const image = await photo();
    await saveDraft(owner, storage, { ...capture(), photos: { add: [image], remove: [] } });
    storage.close(); storage = await LocalStorage.open("photo-upgrade");
    assert.equal((await storage.getPhoto(owner, image.id)).blob.size, image.blob.size);
    assert.equal(await storage.getPhoto(other, image.id), null);
    assert.equal((await storage.listQueue(other)).length, 0);
    const queue = await storage.listQueue(owner);
    assert.equal(queue.at(-1).operation, "photo.upload");
    assert.ok(queue.at(-1).dependsOn.includes(queue[0].operationId));
    // Atomic rollback preserves original finding/queue and creates no false photo.
    harness.failNextPut("photo_local", new Error("synthetic quota"));
    await assert.rejects(saveDraft(owner, storage, { ...capture(), photos: { add: [await photo()], remove: [] } }));
    assert.equal((await storage.listQueue(owner)).length, 3);
    assert.equal((await storage.listPhotos(owner)).length, 1);
    const calls = [], frozen = [], remote = new Map(); let loseAck = true, now = 100000;
    const client = {
      put: async (path, body, opts) => { calls.push(body.kind); return { operationId: opts.operationId, entityId: body.entityId, entityType: body.kind.startsWith("finding") ? "finding" : "inspection", version: 1, appliedAt: at, replayed: false }; },
      post: async (path, body, opts) => { calls.push(body.kind); return { operationId: opts.operationId, entityId: body.entityId, entityType: "inspection", version: 2, appliedAt: at, replayed: false }; },
    };
    const transport = { client, verifyOwner: async () => true, now: () => now, sendPhoto: async (item, local) => {
      calls.push(item.operation); frozen.push(structuredClone(item.frozenRequest));
      assert.ok(local.blob); remote.set(item.entityId, local.sourceHash);
      if (loseAck) { loseAck = false; throw new ApiClientError(503, { code: "UNAVAILABLE", message: "synthetic lost ACK" }); }
      return { operationId: item.operationId, entityId: item.entityId, entityType: "photo", version: 2, appliedAt: at, replayed: true, photo: { ...local, blob: undefined, status: "uploaded", object: { bucket: "finding-photos", path: local.id } } };
    } };
    await enqueueFinalizeIntent(owner, storage, { inspectionId: insp, baseVersion: null, expectedFindingIds: [finding] });
    assert.equal((await runQueue(storage, owner, transport)).failed, 1);
    assert.deepEqual(calls, ["inspection.create", "finding.create", "photo.upload"]);
    assert.ok((await storage.getPhoto(owner, image.id)).blob, "failure retains blob");
    const pending = (await storage.listQueue(owner)).find(item => item.entity === "photo");
    now = Date.parse(pending.nextAttemptAt);
    await runQueue(storage, owner, transport);
    assert.deepEqual(frozen[0], frozen[1], "retry freezes identical metadata/hash"); assert.equal(remote.size, 1);
    assert.equal(calls.at(-1), "inspection.finalize");
    assert.equal((await storage.getPhoto(owner, image.id)).blob, null);
    assert.equal((await storage.getInspection(owner, insp)).workflowStatus, "completed");
    // Separate never-sent draft discard clears photos and every related job.
    storage.close(); storage = await LocalStorage.open("photo-discard");
    await saveDraft(owner, storage, { ...capture(), photos: { add: [await photo()], remove: [] } });
    await discardDraft(owner, storage, insp);
    assert.equal((await storage.listPhotos(owner)).length, 0); assert.equal((await storage.listQueue(owner)).length, 0);
    // Limit is enforced inside the transaction, not just in the UI.
    storage.close(); storage = await LocalStorage.open("photo-limit");
    const three = await Promise.all([photo(), photo(), photo()]);
    await saveDraft(owner, storage, { ...capture(), photos: { add: three, remove: [] } });
    await assert.rejects(saveDraft(owner, storage, { ...capture(), photos: { add: [await photo()], remove: [] } }), /too-many/);
    assert.equal((await storage.listPhotos(owner)).length, 3);
    storage.close(); storage = await LocalStorage.open("photo-conflict-copy");
    await saveDraft(owner, storage, { ...capture(), photos: { add: [await photo()], remove: [] } });
    const conflictClient = {
      ...client,
      get: async () => ({ id: insp, workflowStatus: "completed", version: 3, findings: [], scope: "Synthetic remote" }),
      put: async () => { throw new ApiClientError(409, { code: "VERSION_CONFLICT", message: "Synthetic conflict" }); },
    };
    await runQueue(storage, owner, { client: conflictClient, verifyOwner: async () => true });
    const failed = (await storage.listQueue(owner)).find(item => item.entity === "inspection");
    const { resolveConflict } = require("../src/features/sync/services/resolve-conflict.ts");
    const { newInspectionId } = await resolveConflict({ storage, client: conflictClient, owner, verifyOwner: async () => "technician" }, failed.operationId, "mine");
    const copiedPhotos = await storage.listPhotos(owner, newInspectionId);
    assert.equal(copiedPhotos.length, 1);
    assert.notEqual(copiedPhotos[0].findingId, finding);
    assert.equal(copiedPhotos[0].blob.size, (await storage.listPhotos(owner, insp))[0].blob.size);
    assert.equal((await storage.listQueue(owner)).filter(item => item.operation === "photo.upload").length, 1);
    storage.close();
    // A delayed local read/hash must not expose or write photos after logout.
    const previousSessionStorage = globalThis.localStorage;
    const sessionValues = new Map();
    globalThis.localStorage = { getItem: key => sessionValues.get(key) ?? null, setItem: (key, value) => sessionValues.set(key, value), removeItem: key => sessionValues.delete(key) };
    try {
      const { establishLocalSession, blockLocalSession } = require("../src/lib/pwa/offline-session.ts");
      const { createFindingPhotoRepository } = require("../src/features/findings/services/photo.repository.ts");
      establishLocalSession({ userId: owner, displayName: "Synthetic" });
      let release, writes = 0;
      const repository = createFindingPhotoRepository({ owner, storage: { getPhoto: () => new Promise(resolve => { release = resolve; }), saveCapture: async () => { writes++; } }, fetch: async () => { throw new Error("unexpected request"); } });
      const delayed = repository.read("synthetic-photo");
      blockLocalSession(); release({ blob: new Blob(["synthetic"], { type: "image/png" }), deletedAt: null });
      assert.deepEqual(await delayed, { status: "error", code: "forbidden" });
      establishLocalSession({ userId: owner, displayName: "Synthetic" });
      const currentRepository = createFindingPhotoRepository({ owner, storage: { saveCapture: async () => { writes++; } }, fetch: async () => { throw new Error("unexpected request"); } });
      const attaching = currentRepository.attach({ photoId: crypto.randomUUID(), inspectionId: insp, findingId: finding, file: new Blob(["synthetic"], { type: "image/png" }) });
      blockLocalSession();
      assert.deepEqual(await attaching, { status: "error", code: "forbidden" });
      assert.equal(writes, 0);
    } finally { if (previousSessionStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousSessionStorage; }
    console.log("photo-local.spec.ts: PASS (upgrade/atomicity/partition/replay/finalization/discard/limits/copy/session-race)");
  } finally { globalThis.indexedDB = original; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
