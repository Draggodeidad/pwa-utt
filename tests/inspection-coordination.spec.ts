const assert = require("node:assert/strict");
const { validateCoordinationRequest, coordinationActions } = require("../src/features/inspections/coordination.ts");
const { submitCoordination } = require("../src/features/inspections/services/coordinate-inspection.ts");
const { coordinateInspection, CoordinationError } = require("../src/lib/repositories/coordination.ts");
const { mergeRemoteRefresh } = require("../src/features/inspections/services/local-capture.ts");
const { listVisibleInspectionsPage } = require("../src/lib/repositories/inspections.ts");
const { listVisibleFindingsPage } = require("../src/lib/repositories/findings.ts");
const { createFindingPhotoRepository } = require("../src/features/findings/services/photo.repository.ts");
const { createCoordinationDashboard } = require("../src/features/dashboard/data/coordination-dashboard.ts");
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const OP = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const coordination = { reviewStatus: "pending", reviewNotes: "", reviewedAt: null, reviewedBy: null, archivedAt: null, archivedBy: null };

function readClient() {
  const inspections = [
    { id: ID, folio_number: 1, inspector_id: OWNER, laboratory_id: null, inspection_date: "2026-10-09", summary: "Active", workflow_status: "completed", version: 1, deleted_at: null, archived_at: null },
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", folio_number: 2, inspector_id: OWNER, laboratory_id: null, inspection_date: "2026-10-09", summary: "Archive", workflow_status: "completed", version: 2, deleted_at: null, archived_at: "2026-10-09T10:00:00Z" },
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", folio_number: 3, inspector_id: OWNER, laboratory_id: null, inspection_date: "2026-10-09", summary: "Deleted", workflow_status: "completed", version: 3, deleted_at: "2026-10-09T10:00:00Z", archived_at: null },
  ];
  const tables = { inspections, profiles: [{ id: OWNER, display_name: "Synthetic" }], findings: inspections.map((i, n) => ({ id: `dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12,"0")}`, inspection_id: i.id, status: "pending", title: "Finding", priority: "medium", description: "", deleted_at: null, inspections: i })) };
  return { from(table) {
    let rows = tables[table]; let count = Infinity;
    const field = (row, key) => key.split(".").reduce((value, part) => value?.[part], row);
    const q = { select() { return q; }, eq(key, val) { rows = rows.filter(row => field(row,key) === val); return q; },
      is(key, val) { rows = rows.filter(row => field(row,key) === val); return q; }, not(key, _op, val) { rows = rows.filter(row => field(row,key) !== val); return q; },
      in(key, vals) { rows = rows.filter(row => vals.includes(field(row,key))); return q; }, order() { return q; },
      limit(n) { count = n; return q; }, then(ok, fail) { return Promise.resolve({ data: rows.slice(0,count), error: null }).then(ok,fail); },
    }; return q;
  } };
}

async function main() {
  for (const body of [null, [], {}, { action: "approve", baseVersion: 0 }, { action: "approve", baseVersion: 1.2 }, { action: "approve", baseVersion: 2147483648 }, { action: "reject", baseVersion: 1, notes: " \n " }, { action: "approve", baseVersion: 1, notes: "a".repeat(2001) }, { action: "delete", baseVersion: 1 }, { action: "delete", baseVersion: 1, confirmation: "ins-1" }, { action: "archive", baseVersion: 1, notes: "x" }, { action: "approve", baseVersion: 1, deleted_by: OWNER }, { action: "archive", baseVersion: 1, confirmation: "INS-1" }]) assert.throws(() => validateCoordinationRequest(body));
  assert.deepEqual(validateCoordinationRequest({ action: "reject", baseVersion: 2, notes: "Motivo" }), { action: "reject", baseVersion: 2, notes: "Motivo" });
  assert.deepEqual(coordinationActions({ workflowStatus: "draft", coordination }), []);
  assert.deepEqual(coordinationActions({ workflowStatus: "completed", coordination }), ["approve", "reject"]);
  assert.deepEqual(coordinationActions({ workflowStatus: "completed", coordination: { ...coordination, reviewStatus: "approved" } }), ["archive"]);
  assert.deepEqual(coordinationActions({ workflowStatus: "completed", coordination: { ...coordination, reviewStatus: "rejected" } }), ["archive", "delete"]);
  assert.deepEqual(coordinationActions({ workflowStatus: "completed", coordination: { ...coordination, archivedAt: "2026-10-09", reviewStatus: "approved" } }), ["unarchive", "delete"]);
  let online = false, current = true, calls = [];
  const client = { get: async () => { calls.push("session"); return { user: { id: OWNER, role: "coordinator" } }; }, post: async (path, body, opts) => { calls.push({ path, body, opts }); return { id: ID, version: 2 }; } };
  const context = { owner: OWNER, isOnline: () => online, isCurrent: () => current };
  const request = { action: "approve", baseVersion: 1 };
  await assert.rejects(submitCoordination(client, ID, request, OP, context), /conexión/);
  assert.deepEqual(calls, [], "offline never writes or queues");
  online = true;
  assert.equal((await submitCoordination(client, ID, request, OP, context)).version, 2);
  assert.deepEqual(calls[1], { path: `/api/inspections/${ID}/coordination`, body: request, opts: { operationId: OP } });
  client.get = async () => { online = false; return { user: { id: OWNER, role: "coordinator" } }; };
  const before = calls.length;
  await assert.rejects(submitCoordination(client, ID, request, OP, context), /conexión/);
  assert.equal(calls.length, before, "loss of connectivity before POST blocks mutation");
  online = true;
  client.get = async () => { current = false; return { user: { id: OWNER, role: "coordinator" } }; };
  await assert.rejects(submitCoordination(client, ID, request, OP, context), /sesión cambió/);
  current = true; client.get = async () => ({ user: { id: OWNER, role: "technician" } });
  await assert.rejects(submitCoordination(client, ID, request, OP, context), /coordinación/);
  client.get = async () => ({ user: { id: ID, role: "coordinator" } });
  await assert.rejects(submitCoordination(client, ID, request, OP, context), /coordinación/);
  for (const [code, status] of [["UNAUTHENTICATED",401],["FORBIDDEN",403],["NOT_FOUND",404],["VERSION_CONFLICT",409],["VERSION_OR_STATE_CONFLICT",409],["IDEMPOTENCY_KEY_REUSED",409],["INVALID_CONFIRMATION",422],["INVALID_INPUT",422],["unknown SQL detail",503]]) {
    await assert.rejects(coordinateInspection({ rpc: async () => ({ data: null, error: { message: code } }) }, ID, OP, request), error => error instanceof CoordinationError && error.status === status && !error.message.includes("SQL detail"));
  }
  const rpc = { rpc: async (name,args) => { assert.equal(name,"coordinate_inspection"); assert.deepEqual(args, { p_operation_id:OP, p_inspection_id:ID, p_base_version:1, p_action:"approve", p_notes:"", p_confirmation:"" }); return { data:{ id:ID,version:2 }, error:null }; } };
  assert.equal((await coordinateInspection(rpc,ID,OP,request)).version,2);
  const synced = { id: ID, syncStatus: "synced" };
  const pending = { id: OWNER, syncStatus: "pending" };
  assert.deepEqual(mergeRemoteRefresh([synced,pending],[],new Set(),true),[pending],"authoritative refresh hides absent synced records, preserves pending work");
  assert.deepEqual(mergeRemoteRefresh([synced,pending],[]),[synced,pending],"offline/error snapshots keep local data");
  const active = await listVisibleInspectionsPage(readClient(),{});
  const archived = await listVisibleInspectionsPage(readClient(),{archived:true});
  assert.deepEqual(active.items.map(row=>row.folio),["INS-1"]);
  assert.deepEqual(archived.items.map(row=>row.folio),["INS-2"]);
  assert.equal(createCoordinationDashboard(active.items).summary.inspectionCount,1);
  assert.equal(createCoordinationDashboard(active.items).summary.findingCount,1);
  const findings = await listVisibleFindingsPage(readClient(),{});
  assert.equal(findings.items.length,1,"server filters archived/deleted parents before pagination");
  const noLocalStorage = new Proxy({}, { get() { throw new Error("Coordination must not use cached evidence"); } });
  for (const status of [401,403,404,503]) {
    const photos = createFindingPhotoRepository({ owner:OWNER, storage:noLocalStorage, remoteOnly:true, fetch:async()=>new Response("{}",{status}) });
    assert.equal((await photos.list(ID)).status,"error",`photo HTTP ${status} must not appear as zero evidence`);
    assert.equal((await photos.read(ID)).status,"error");
  }
  const localPhotos = createFindingPhotoRepository({ owner:OWNER, storage:{ listPhotos:async()=>[{id:OP,deletedAt:null}] }, fetch:async()=>new Response("{}",{status:404}) });
  assert.deepEqual((await localPhotos.list(ID)).value.map(row=>row.id),[OP],"unsynced technician draft retains local evidence on remote 404");
  const photo = { id:ID, findingId:ID, status:"uploaded" };
  const photos = createFindingPhotoRepository({ owner:OWNER, storage:noLocalStorage, remoteOnly:true, fetch:async(path)=>path.includes("/photos/") ? new Response(new Blob(["synthetic bytes"],{type:"image/png"})) : new Response(JSON.stringify([photo])) });
  assert.deepEqual((await photos.list(ID)).value,[photo],"authorized remote evidence bypasses stale local metadata");
  assert.equal((await photos.read(ID)).value.size,15);
  const failedPhotos = createFindingPhotoRepository({ owner:OWNER, storage:noLocalStorage, remoteOnly:true, fetch:async()=>{ throw new Error("offline"); } });
  assert.equal((await failedPhotos.list(ID)).status,"error");
  console.log("PASS inspection coordination: validation, eligibility, online/session gates, RPC errors, active/archive metrics and cache reconciliation");
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
