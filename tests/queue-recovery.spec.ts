const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { ApiClientError } = require("../src/lib/api/client.ts");
const { HttpClient } = require("../src/lib/api/http-client.ts");
const { recoveryState } = require("../src/lib/pwa/sync/queue.ts");
const { saveDraft, finalizeDraft } = require("../src/features/inspections/services/local-capture.ts");
const { runQueue } = require("../src/lib/pwa/sync/runner.ts");

const owner = "11111111-1111-4111-8111-111111111111";
const inspectionId = "33333333-3333-4333-8333-333333333333";
const findingId = "44444444-4444-4444-8444-444444444444";
const appliedAt = "2026-09-30T01:00:00Z";

function inspection() {
  return {
    id: inspectionId, folioNumber: 0, laboratoryId: null, inspectorId: owner,
    inspectionDate: "2026-09-30", summary: "Offline", workflowStatus: "draft", updatedBy: owner,
    createdAt: appliedAt, updatedAt: appliedAt, version: 0, completedAt: null, deletedAt: null,
    ownerUserId: owner, localRevision: 1, baseVersion: null, syncStatus: "local", localUpdatedAt: appliedAt,
  };
}

function finding() {
  return {
    id: findingId, inspectionId, title: "Cableado", description: "Revisión", priority: "medium", status: "pending",
    createdBy: owner, updatedBy: owner, createdAt: appliedAt, updatedAt: appliedAt, version: 0,
    resolvedAt: null, deletedAt: null, ownerUserId: owner, localRevision: 1,
    baseVersion: null, syncStatus: "local", localUpdatedAt: appliedAt,
  };
}

function client(send) {
  return {
    post: (_path, body, options) => send(body, options.operationId),
    put: (_path, body, options) => send(body, options.operationId),
    patch: (_path, body, options) => send(body, options.operationId),
    delete: (_path, options) => send(options.body, options.operationId),
  };
}

function ack(body, key, replayed = false) {
  return { operationId: key, entityId: body.entityId,
    entityType: body.kind.startsWith("inspection") ? "inspection" : "finding",
    version: body.kind === "inspection.finalize" ? 2 : 1, appliedAt, replayed,
    ...(body.kind === "inspection.create" ? { folioNumber: 42 } : {}) };
}

async function main() {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = createIndexedDbHarness().indexedDB;
  try {
    // Retry-After survives reload; bounded exponential backoff reaches a terminal state.
    {
      let time = 1_000_000;
      let calls = 0;
      let storage = await LocalStorage.open("backoff");
      await saveDraft(owner, storage, { owner, inspection: inspection(), findings: [], removedFindings: [] });
      const transport = { verifyOwner: async () => true, now: () => time,
        client: client(async () => { calls++; throw new ApiClientError(429, { code: "UNAVAILABLE", message: "rate limit" }, 7000); }) };
      assert.equal((await runQueue(storage, owner, transport)).failed, 1);
      let item = (await storage.listQueue(owner))[0];
      assert.equal(item.attempts, 1);
      assert.equal(Date.parse(item.nextAttemptAt), time + 7000);
      storage.close();
      storage = await LocalStorage.open("backoff");
      assert.equal((await runQueue(storage, owner, transport)).failed, 0);
      assert.equal(calls, 1);
      for (let attempt = 2; attempt <= 5; attempt++) {
        time = Date.parse(item.nextAttemptAt);
        assert.equal((await runQueue(storage, owner, transport)).failed, 1);
        item = (await storage.listQueue(owner))[0];
        assert.equal(item.attempts, attempt);
      }
      assert.equal(item.nextAttemptAt, null);
      assert.equal(item.retryExhausted, true);
      assert.equal(recoveryState(item, [item], time), "retry_exhausted");
      assert.equal((await runQueue(storage, owner, transport)).failed, 0);
      assert.equal(calls, 5);
      storage.close();
    }

    // 401 pauses; authorization, validation and conflicts preserve the frozen request without automatic replay.
    for (const status of [401, 403, 422, 409]) {
      const storage = await LocalStorage.open(`terminal-${status}`);
      await saveDraft(owner, storage, { owner, inspection: inspection(), findings: [], removedFindings: [] });
      let calls = 0;
      const transport = { verifyOwner: async () => true, client: client(async () => {
        calls++;
        throw new ApiClientError(status, { code: status === 409 ? "VERSION_CONFLICT" : "FORBIDDEN", message: "stop", remoteSnapshot: { version: 2 } });
      }) };
      const result = await runQueue(storage, owner, transport);
      assert.equal(result.paused, status === 401);
      const item = (await storage.listQueue(owner))[0];
      assert.equal(item.nextAttemptAt, null);
      assert.equal(item.retryExhausted, false);
      assert.ok(item.frozenRequest);
      assert.deepEqual(item.lastError.remoteSnapshot, { version: 2 });
      assert.equal(recoveryState(item, [item], Date.now()), "intervention");
      await runQueue(storage, owner, transport);
      assert.equal(calls, 1);
      storage.close();
    }

    // Two tabs: one sends, the contender waits; after expiry a new owner replays the receipt.
    {
      let time = 2_000_000;
      const first = await LocalStorage.open("lease");
      const second = await LocalStorage.open("lease");
      await saveDraft(owner, first, { owner, inspection: inspection(), findings: [], removedFindings: [] });
      let resolveFirst;
      let calls = 0;
      const remote = new Map();
      const send = client(async (body, key) => {
        calls++;
        if (!remote.has(key)) remote.set(key, ack(body, key));
        if (calls === 1) return new Promise((resolve) => { resolveFirst = resolve; });
        return { ...remote.get(key), replayed: true };
      });
      const transport = { client: send, verifyOwner: async () => true, now: () => time };
      const oldRun = runQueue(first, owner, transport);
      while (!resolveFirst) await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal((await runQueue(second, owner, transport)).paused, true);
      assert.equal(calls, 1);
      time += 30_001;
      assert.equal((await runQueue(second, owner, transport)).acknowledged, 1);
      resolveFirst(remote.values().next().value);
      assert.equal((await oldRun).paused, true, "stale tab cannot commit an ACK");
      assert.equal(calls, 2);
      assert.equal(remote.size, 1);
      assert.equal((await second.listQueue(owner)).length, 0);
      first.close(); second.close();
    }

    // D7 local journey: offline capture, reopen, reconnect, lose first ACK, reopen, replay and finalize in order.
    {
      let time = 3_000_000;
      let storage = await LocalStorage.open("journey");
      await finalizeDraft(owner, storage, { owner, inspection: inspection(), findings: [finding()],
        removedFindings: [], expectedFindingIds: [findingId] });
      storage.close();
      storage = await LocalStorage.open("journey");
      assert.equal((await storage.listQueue(owner)).length, 3);
      const remote = new Map();
      const sent = [];
      let loseAck = true;
      const transport = { verifyOwner: async () => true, now: () => time, client: client(async (body, key) => {
        sent.push({ key, body: structuredClone(body) });
        if (!remote.has(key)) remote.set(key, ack(body, key));
        if (loseAck) { loseAck = false; throw new Error("response lost after remote commit"); }
        return { ...remote.get(key), replayed: sent.some((prior) => prior.key === key && prior !== sent.at(-1)) };
      }) };
      assert.equal((await runQueue(storage, owner, transport)).failed, 1);
      let queue = await storage.listQueue(owner);
      assert.equal(queue.length, 3);
      assert.equal(recoveryState(queue[1], queue, time), "blocked_dependency");
      storage.close();
      storage = await LocalStorage.open("journey");
      queue = await storage.listQueue(owner);
      time = Date.parse(queue[0].nextAttemptAt);
      assert.equal((await runQueue(storage, owner, transport)).acknowledged, 3);
      assert.deepEqual(sent.map(({ body }) => body.kind), ["inspection.create", "inspection.create", "finding.create", "inspection.finalize"]);
      assert.deepEqual(sent[0], sent[1], "lost ACK replay keeps key and entire request");
      assert.equal(remote.size, 3, "one remote receipt per operation");
      assert.equal((await storage.listQueue(owner)).length, 0);
      assert.equal((await storage.getInspection(owner, inspectionId)).workflowStatus, "completed");
      storage.close();
    }

    // Wire Retry-After is parsed by the real HTTP adapter.
    {
      const http = new HttpClient({ fetch: async () => new Response(JSON.stringify({ code: "UNAVAILABLE", error: "later" }), {
        status: 429, headers: { "Retry-After": "12" },
      }) });
      await assert.rejects(() => http.get("/api/inspections"), (error) => error instanceof ApiClientError && error.retryAfterMs === 12_000);
      const timed = new HttpClient({ timeoutMs: 5, fetch: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }) });
      await assert.rejects(() => timed.get("/api/inspections"), (error) => error instanceof ApiClientError && error.status === 503);
    }
    console.log("queue-recovery.spec.ts: PASS");
  } finally {
    globalThis.indexedDB = previous;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
