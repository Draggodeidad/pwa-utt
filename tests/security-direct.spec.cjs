const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const accounts = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const match = /^--(a|b|coord|inactive)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Unknown argument: ${argument}`);
  return [match[1], match[2]];
}));

function requireConfiguration() {
  assert.ok(process.env.SUPABASE_URL, "SUPABASE_URL is required");
  assert.ok(process.env.SUPABASE_ANON_KEY, "SUPABASE_ANON_KEY is required");
  for (const role of ["a", "b", "coord", "inactive"]) {
    assert.ok(accounts[role], `--${role}=<test email> is required`);
  }
  assert.equal(new Set(Object.values(accounts)).size, 4, "test accounts must be distinct");
}

function readPassword() {
  assert.ok(process.stdin.isTTY, "run from a terminal to enter the shared test password");
  process.stdout.write("Shared synthetic test password: ");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.off("data", receive);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const receive = (bytes) => {
      for (const byte of bytes) {
        if (byte === 13 || byte === 10) {
          finish();
          resolve(value);
          return;
        }
        if (byte === 3) {
          finish();
          reject(new Error("Password entry cancelled"));
          return;
        }
        if (byte === 127) value = value.slice(0, -1);
        else value += String.fromCharCode(byte);
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", receive);
  });
}

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticate(email, password) {
  const api = client();
  const { data, error } = await api.auth.signInWithPassword({ email, password });
  assert.equal(error, null, `${email}: normal user login must succeed`);
  assert.ok(data.session?.access_token, `${email}: normal user JWT is required`);
  return { api, id: data.user.id };
}

function operation(kind, entityId, baseVersion, payload, clientId) {
  return { p_operation_id: randomUUID(), p_client_id: clientId, p_kind: kind,
    p_entity_id: entityId, p_base_version: baseVersion, p_payload: payload };
}

async function call(actor, input, expectedError) {
  const { data, error } = await actor.api.rpc("apply_operation", input);
  if (expectedError) {
    assert.ok(error, `${input.p_kind}: expected ${expectedError}`);
    assert.equal(error.message, expectedError, `${input.p_kind}: safe domain error`);
    return error;
  }
  assert.equal(error, null, `${input.p_kind}: ${error?.message}`);
  assert.equal(data.id, input.p_entity_id);
  return data;
}

async function rows(actor, table, id) {
  const query = actor.api.from(table).select("*").eq("id", id);
  const { data, error } = await query;
  assert.equal(error, null, `${table} read: ${error?.message}`);
  return data;
}

async function receipt(actor, id, expected) {
  const { data, error } = await actor.api.from("operation_receipts")
    .select("operation_id,result").eq("operation_id", id);
  assert.equal(error, null, `receipt read: ${error?.message}`);
  assert.equal(data.length, expected, `receipt ${id}: atomicity`);
  return data[0];
}

async function visibleReceipts(actor, id) {
  const { data, error } = await actor.api.from("operation_receipts")
    .select("operation_id").eq("operation_id", id);
  assert.equal(error, null, `receipt visibility: ${error?.message}`);
  return data;
}

async function deniedWrite(actor, table, body, id) {
  const { error } = await actor.api.from(table).update(body).eq("id", id);
  assert.ok(error, `${table}: direct update must be denied`);
  assert.equal(error.code, "42501", `${table}: permission denial`);
}

async function main() {
  requireConfiguration();
  const password = await readPassword();
  const [a, b, coord, inactive] = await Promise.all([
    authenticate(accounts.a, password), authenticate(accounts.b, password),
    authenticate(accounts.coord, password), authenticate(accounts.inactive, password),
  ]);
  assert.equal(new Set([a.id, b.id, coord.id, inactive.id]).size, 4);
  for (const [actor, role] of [[a, "technician"], [b, "technician"], [coord, "coordinator"]]) {
    const own = await rows(actor, "profiles", actor.id);
    assert.equal(own.length, 1);
    assert.equal(own[0].role, role);
    assert.equal(own[0].active, true);
  }
  assert.deepEqual(await rows(inactive, "profiles", inactive.id), []);
  assert.deepEqual(await rows(a, "profiles", b.id), []);
  assert.equal((await rows(coord, "profiles", a.id)).length, 1);
  console.log("PASS normal JWT identities, profiles, inactive RLS");

  const anon = client();
  const anonymousRead = await anon.from("inspections").select("id").limit(1);
  assert.ok(anonymousRead.error, "anon SELECT must be denied");
  const anonCall = await anon.rpc("apply_operation", operation("inspection.create", randomUUID(), null, {}, randomUUID()));
  assert.ok(anonCall.error, "anon EXECUTE must be denied");
  assert.deepEqual((await inactive.api.from("inspections").select("id")).data, []);
  const inactiveOp = operation("inspection.create", randomUUID(), null, {}, randomUUID());
  await call(inactive, inactiveOp, "FORBIDDEN");
  await receipt(inactive, inactiveOp.p_operation_id, 0);
  console.log("PASS anonymous and inactive reads/writes denied");

  const aClient = randomUUID();
  const bClient = randomUUID();
  const aId = randomUUID();
  const bId = randomUUID();
  const aCreate = operation("inspection.create", aId, null, { summary: "phase26 A draft" }, aClient);
  const bCreate = operation("inspection.create", bId, null, { summary: "phase26 B draft" }, bClient);
  const [aInitial, bInitial] = await Promise.all([call(a, aCreate), call(b, bCreate)]);
  assert.equal(aInitial.__replayed, false);
  assert.equal(bInitial.__replayed, false);
  assert.equal((await rows(a, "inspections", aId)).length, 1);
  assert.deepEqual(await rows(a, "inspections", bId), []);
  assert.deepEqual(await rows(b, "inspections", aId), []);
  assert.deepEqual(await rows(coord, "inspections", aId), []);
  assert.equal((await receipt(a, aCreate.p_operation_id, 1)).result.version, aInitial.version);
  assert.deepEqual(await visibleReceipts(b, aCreate.p_operation_id), []);
  assert.deepEqual(await visibleReceipts(coord, aCreate.p_operation_id), []);
  await deniedWrite(a, "profiles", { role: "coordinator" }, a.id);
  await deniedWrite(a, "inspections", { inspector_id: b.id }, aId);
  await deniedWrite(coord, "inspections", { summary: "spoof" }, aId);
  const receiptTamper = await a.api.from("operation_receipts")
    .update({ result: { version: 999 } }).eq("operation_id", aCreate.p_operation_id);
  assert.equal(receiptTamper.error?.code, "42501", "direct receipt edit must be denied");
  const coordinatorCreate = operation("inspection.create", randomUUID(), null, {}, randomUUID());
  await call(coord, coordinatorCreate, "FORBIDDEN_OR_INVALID_INPUT");
  await receipt(coord, coordinatorCreate.p_operation_id, 0);
  console.log("PASS A/B/coordinator isolation, receipts and direct write grants");

  const replay = await call(a, aCreate);
  assert.equal(replay.__replayed, true);
  assert.equal(replay.version, aInitial.version);
  const changedKey = { ...aCreate, p_payload: { summary: "altered" } };
  await call(a, changedKey, "IDEMPOTENCY_KEY_REUSED");
  assert.equal((await rows(a, "inspections", aId))[0].summary, "phase26 A draft");
  const duplicate = operation("inspection.create", aId, null, { summary: "duplicate id" }, aClient);
  const duplicateError = await a.api.rpc("apply_operation", duplicate);
  assert.equal(duplicateError.error?.code, "23505", "duplicate UUID must be a unique conflict");
  await receipt(a, duplicate.p_operation_id, 0);
  const foreignEdit = operation("inspection.update", aId, aInitial.version, { summary: "B spoof" }, bClient);
  await call(b, foreignEdit, "NOT_FOUND");
  await receipt(b, foreignEdit.p_operation_id, 0);
  const roleSpoof = operation("inspection.update", aId, aInitial.version, { inspectorId: b.id }, aClient);
  await call(a, roleSpoof, "INVALID_INPUT");
  await receipt(a, roleSpoof.p_operation_id, 0);
  console.log("PASS inspection replay, altered key, reused UUID, field/owner protection");

  const raceId = randomUUID();
  const raceCreate = operation("inspection.create", raceId, null, {}, aClient);
  const raceInitial = await call(a, raceCreate);
  const edits = ["race one", "race two"].map((summary) =>
    operation("inspection.update", raceId, raceInitial.version, { summary }, aClient));
  const outcomes = await Promise.all(edits.map((input) => a.api.rpc("apply_operation", input)));
  assert.equal(outcomes.filter(({ error }) => !error).length, 1);
  assert.equal(outcomes.filter(({ error }) => error?.message === "VERSION_OR_STATE_CONFLICT").length, 1);
  for (let index = 0; index < edits.length; index++) {
    await receipt(a, edits[index].p_operation_id, outcomes[index].error ? 0 : 1);
  }
  assert.equal((await rows(a, "inspections", raceId))[0].version, raceInitial.version + 1);
  console.log("PASS concurrent inspection version conflict and atomic receipts");

  const findingId = randomUUID();
  const findingCreate = operation("finding.create", findingId, null,
    { inspectionId: aId, title: "phase26 finding", description: "", priority: "medium" }, aClient);
  const findingInitial = await call(a, findingCreate);
  assert.equal((await rows(a, "findings", findingId)).length, 1);
  assert.deepEqual(await rows(b, "findings", findingId), []);
  assert.deepEqual(await rows(coord, "findings", findingId), []);
  await deniedWrite(a, "findings", { title: "direct edit" }, findingId);
  const foreignFinding = operation("finding.create", randomUUID(), null,
    { inspectionId: aId, title: "B spoof" }, bClient);
  await call(b, foreignFinding, "NOT_EDITABLE");
  await receipt(b, foreignFinding.p_operation_id, 0);
  assert.equal((await call(a, findingCreate)).__replayed, true);
  await call(a, { ...findingCreate, p_payload: { ...findingCreate.p_payload, title: "altered" } }, "IDEMPOTENCY_KEY_REUSED");
  const duplicateFinding = operation("finding.create", findingId, null,
    { inspectionId: aId, title: "duplicate" }, aClient);
  assert.equal((await a.api.rpc("apply_operation", duplicateFinding)).error?.code, "23505");
  await receipt(a, duplicateFinding.p_operation_id, 0);
  const findingEdits = ["edited one", "edited two"].map((title) =>
    operation("finding.update", findingId, findingInitial.version, { title }, aClient));
  const findingOutcomes = await Promise.all(findingEdits.map((input) => a.api.rpc("apply_operation", input)));
  assert.equal(findingOutcomes.filter(({ error }) => !error).length, 1);
  assert.equal(findingOutcomes.filter(({ error }) => error?.message === "VERSION_CONFLICT").length, 1);
  for (let index = 0; index < findingEdits.length; index++) {
    await receipt(a, findingEdits[index].p_operation_id, findingOutcomes[index].error ? 0 : 1);
  }
  console.log("PASS finding isolation, replay, UUID reuse and concurrent versions");

  const laboratories = await a.api.from("laboratories").select("id").eq("active", true).limit(1);
  assert.equal(laboratories.error, null);
  assert.equal(laboratories.data.length, 1, "active laboratory required for finalization");
  const labId = laboratories.data[0].id;
  const incompleteFinalize = operation("inspection.finalize", aId, aInitial.version,
    { expectedFindingIds: [findingId] }, aClient);
  await call(a, incompleteFinalize, "FINALIZATION_INVALID");
  await receipt(a, incompleteFinalize.p_operation_id, 0);
  const setConflict = operation("inspection.finalize", aId, aInitial.version,
    { expectedFindingIds: [] }, aClient);
  await call(a, setConflict, "FINDING_SET_CONFLICT");
  await receipt(a, setConflict.p_operation_id, 0);
  const ready = operation("inspection.update", aId, aInitial.version,
    { laboratoryId: labId, inspectionDate: "2026-10-01", summary: "phase26 completed" }, aClient);
  const readyRow = await call(a, ready);
  const finalize = operation("inspection.finalize", aId, readyRow.version,
    { expectedFindingIds: [findingId] }, aClient);
  const completed = await call(a, finalize);
  assert.equal(completed.workflow_status, "completed");
  assert.equal((await rows(coord, "inspections", aId)).length, 1);
  assert.equal((await rows(coord, "findings", findingId)).length, 1);
  assert.deepEqual(await rows(b, "inspections", aId), []);
  assert.equal((await call(a, finalize)).__replayed, true);
  const postFinalEdit = operation("finding.update", findingId,
    (await rows(a, "findings", findingId))[0].version, { title: "late edit" }, aClient);
  await call(a, postFinalEdit, "NOT_EDITABLE");
  await receipt(a, postFinalEdit.p_operation_id, 0);
  const postFinalInspection = operation("inspection.update", aId, completed.version,
    { summary: "late edit" }, aClient);
  await call(a, postFinalInspection, "VERSION_OR_STATE_CONFLICT");
  await receipt(a, postFinalInspection.p_operation_id, 0);
  console.log("PASS finalization set/required fields, immutable capture and coordinator reads");

  const currentFinding = (await rows(coord, "findings", findingId))[0];
  const skip = operation("finding.followup", findingId, currentFinding.version,
    { status: "resolved" }, randomUUID());
  await call(coord, skip, "INVALID_TRANSITION");
  await receipt(coord, skip.p_operation_id, 0);
  const titleSpoof = operation("finding.followup", findingId, currentFinding.version,
    { title: "coordinator spoof" }, randomUUID());
  await call(coord, titleSpoof, "FORBIDDEN_OR_INVALID_INPUT");
  const technicianFollowup = operation("finding.followup", findingId, currentFinding.version,
    { status: "in_review" }, aClient);
  await call(a, technicianFollowup, "FORBIDDEN_OR_INVALID_INPUT");
  const review = operation("finding.followup", findingId, currentFinding.version,
    { status: "in_review", priority: "high" }, randomUUID());
  const reviewed = await call(coord, review);
  assert.equal(reviewed.status, "in_review");
  assert.equal(reviewed.priority, "high");
  assert.equal((await call(coord, review)).__replayed, true);
  const resolved = await call(coord, operation("finding.followup", findingId, reviewed.version,
    { status: "resolved" }, randomUUID()));
  assert.equal(resolved.status, "resolved");
  assert.ok(resolved.resolved_at);
  console.log("PASS coordinator field/state protection and follow-up receipts");

  const deletedFindingId = randomUUID();
  const spare = await call(b, operation("finding.create", deletedFindingId, null,
    { inspectionId: bId, title: "temporary finding" }, bClient));
  await call(b, operation("finding.delete", deletedFindingId, spare.version, {}, bClient));
  assert.deepEqual(await rows(b, "findings", deletedFindingId), []);
  const recreateFinding = operation("finding.create", deletedFindingId, null,
    { inspectionId: bId, title: "resurrected" }, bClient);
  assert.equal((await b.api.rpc("apply_operation", recreateFinding)).error?.code, "23505");
  await receipt(b, recreateFinding.p_operation_id, 0);
  console.log("PASS deleted finding UUID cannot be resurrected");

  const parentRaceId = randomUUID();
  const parentRace = await call(a, operation("inspection.create", parentRaceId, null,
    { laboratoryId: labId, inspectionDate: "2026-10-01", summary: "phase26 finalization race" }, aClient));
  const parentRaceFindingId = randomUUID();
  const createDuringFinalize = operation("finding.create", parentRaceFindingId, null,
    { inspectionId: parentRaceId, title: "concurrent finding" }, aClient);
  const finalizeDuringCreate = operation("inspection.finalize", parentRaceId, parentRace.version,
    { expectedFindingIds: [] }, aClient);
  const [creationRaceResult, finalizeRaceResult] = await Promise.all([
    a.api.rpc("apply_operation", createDuringFinalize),
    a.api.rpc("apply_operation", finalizeDuringCreate),
  ]);
  assert.notEqual(Boolean(creationRaceResult.error), Boolean(finalizeRaceResult.error),
    "creation/finalization race must have exactly one winning operation");
  assert.ok(["NOT_EDITABLE", "FINDING_SET_CONFLICT"].includes(
    creationRaceResult.error?.message ?? finalizeRaceResult.error?.message));
  await receipt(a, createDuringFinalize.p_operation_id, creationRaceResult.error ? 0 : 1);
  await receipt(a, finalizeDuringCreate.p_operation_id, finalizeRaceResult.error ? 0 : 1);
  if (!creationRaceResult.error) {
    const currentParent = (await rows(a, "inspections", parentRaceId))[0];
    await call(a, operation("inspection.finalize", parentRaceId, currentParent.version,
      { expectedFindingIds: [parentRaceFindingId] }, aClient));
  }
  assert.equal((await rows(a, "inspections", parentRaceId))[0].workflow_status, "completed");

  const editRaceId = randomUUID();
  const editRaceParent = await call(a, operation("inspection.create", editRaceId, null,
    { laboratoryId: labId, inspectionDate: "2026-10-01", summary: "phase26 edit race" }, aClient));
  const editRaceFindingId = randomUUID();
  const editRaceFinding = await call(a, operation("finding.create", editRaceFindingId, null,
    { inspectionId: editRaceId, title: "original" }, aClient));
  const editDuringFinalize = operation("finding.update", editRaceFindingId,
    editRaceFinding.version, { title: "concurrent edit" }, aClient);
  const finalizeDuringEdit = operation("inspection.finalize", editRaceId,
    editRaceParent.version, { expectedFindingIds: [editRaceFindingId] }, aClient);
  const [editRaceResult, editFinalizeResult] = await Promise.all([
    a.api.rpc("apply_operation", editDuringFinalize),
    a.api.rpc("apply_operation", finalizeDuringEdit),
  ]);
  assert.equal(editFinalizeResult.error, null, "finalization must serialize after/before finding edit");
  assert.ok(!editRaceResult.error || editRaceResult.error.message === "NOT_EDITABLE");
  await receipt(a, editDuringFinalize.p_operation_id, editRaceResult.error ? 0 : 1);
  await receipt(a, finalizeDuringEdit.p_operation_id, 1);
  assert.equal((await rows(a, "inspections", editRaceId))[0].workflow_status, "completed");
  assert.equal((await rows(a, "findings", editRaceFindingId)).length, 1);
  console.log("PASS finding create/edit versus finalization races serialize atomically");

  const deletedInspection = operation("inspection.discard", raceId,
    (await rows(a, "inspections", raceId))[0].version, {}, aClient);
  await call(a, deletedInspection);
  assert.deepEqual(await rows(a, "inspections", raceId), []);
  const recreateDeleted = operation("inspection.create", raceId, null, {}, aClient);
  assert.equal((await a.api.rpc("apply_operation", recreateDeleted)).error?.code, "23505");
  await receipt(a, recreateDeleted.p_operation_id, 0);
  console.log("PASS deleted UUID cannot be resurrected");

  // The operation and receipt are checked after each negative/concurrent path above.
  // Keep the synthetic completed record as evidence; never delete unrelated data.
  console.log("security-direct.spec.cjs: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
