const assert = require("node:assert/strict");
const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage } = require("../src/lib/pwa/offline-storage.ts");
const { finalizeDraft, saveDraft, enqueueFinalizeIntent } = require("../src/features/inspections/services/local-capture.ts");
const { validateInspectionFinalization, validateInspectionDraft } = require("../src/features/inspections/schemas/inspection.schema.ts");
const { runQueue } = require("../src/lib/pwa/sync/runner.ts");
const { ApiClientError } = require("../src/lib/api/client.ts");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const owner = "11111111-1111-4111-8111-111111111170";
const inspectionId = "66666666-6666-4666-8666-666666666670";
const at = "2026-10-09T12:00:00.000Z";
const gps = { latitude: 19.4326, longitude: -99.1332, accuracy: 12.5, capturedAt: at };
function capture() {
  return { owner, inspection: { id: inspectionId, folioNumber: 0, laboratoryId: "55555555-5555-4555-8555-555555555570", inspectorId: owner,
    inspectionDate: "2026-10-09", summary: "Synthetic GPS", workflowStatus: "draft", updatedBy: owner,
    version: 0, completedAt: null, deletedAt: null, createdAt: at, updatedAt: at,
    ownerUserId: owner, localRevision: 1, baseVersion: null, syncStatus: "local", localUpdatedAt: at },
    findings: [], removedFindings: [] };
}
async function main() {
  assert.deepEqual(validateInspectionFinalization({ expectedFindingIds: [], location: gps }).location, gps);
  assert.equal(validateInspectionFinalization({ expectedFindingIds: [], location: null }).location, null);
  assert.deepEqual(validateInspectionFinalization({ expectedFindingIds: [] }), { expectedFindingIds: [] }, "legacy queue remains valid");
  for (const invalid of [
    { ...gps, latitude: 91 }, { ...gps, longitude: -181 }, { ...gps, accuracy: -1 }, { ...gps, accuracy: Infinity },
    { ...gps, latitude: "19" }, { ...gps, capturedAt: "2026-02-30T12:00:00Z" }, { ...gps, capturedAt: "yesterday" },
    { ...gps, capturedAt: "2026-10-09" }, { ...gps, extra: true }, { latitude: 1 }, [],
  ]) assert.throws(() => validateInspectionFinalization({ expectedFindingIds: [], location: invalid }));
  assert.throws(() => validateInspectionDraft({ location: gps }), "GPS cannot be saved with draft");

  const original = globalThis.indexedDB;
  globalThis.indexedDB = createIndexedDbHarness().indexedDB;
  try {
    let storage = await LocalStorage.open("gps-finalization");
    await saveDraft(owner, storage, { ...capture(), location: gps });
    assert.ok(!(await storage.listQueue(owner)).some(item => "location" in item.payload), "draft queue never stores capture");
    assert.ok(!("location" in await storage.getInspection(owner, inspectionId)));
    await finalizeDraft(owner, storage, { ...capture(), expectedFindingIds: [], location: gps });
    storage.close();
    storage = await LocalStorage.open("gps-finalization");
    assert.deepEqual((await storage.listQueue(owner)).at(-1).payload.location, gps, "snapshot survives offline reload");
    assert.equal((await storage.listQueue("22222222-2222-4222-8222-222222222270")).length, 0, "GPS queue is isolated by owner");
    const requests = [];
    let lostAck = true;
    let now = 100000;
    const ack = (body, options) => ({ operationId: options.operationId, entityId: body.entityId, entityType: "inspection", version: body.baseVersion == null ? 1 : body.baseVersion + 1, appliedAt: at, replayed: false });
    const client = {
      put: async (_path, body, options) => ack(body, options),
      patch: async (_path, body, options) => ack(body, options),
      post: async (_path, body, options) => {
        requests.push({ body: structuredClone(body), operationId: options.operationId });
        if (lostAck) { lostAck = false; throw new ApiClientError(503, { code: "UNAVAILABLE", message: "Synthetic lost ACK" }); }
        return { ...ack(body, options), replayed: true };
      },
    };
    const transport = { client, verifyOwner: async () => true, now: () => now };
    await runQueue(storage, owner, transport);
    now += 100000;
    await runQueue(storage, owner, transport);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1], "retry retains operation ID and exact GPS timestamp");
    assert.deepEqual(requests[1].body.payload.location, gps);
    assert.equal((await storage.listQueue(owner)).length, 0);
    storage.close();
    const empty = await LocalStorage.open("gps-cleared");
    assert.equal((await enqueueFinalizeIntent(owner, empty, { inspectionId, baseVersion: 1, expectedFindingIds: [], location: null })).payload.location, null, "cleared capture finalizes with null");
    empty.close();
  } finally { globalThis.indexedDB = original; }

  // Render the actual shared coordinator component, including precision and timestamp.
  const file = resolve(__dirname, "../src/features/inspections/components/InspectionLocation.tsx");
  const compiled = new Module(file, module);
  compiled.filename = file;
  compiled.paths = Module._nodeModulePaths(resolve(file, ".."));
  compiled._compile(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const { InspectionLocation } = compiled.exports;
  const render = inspection => renderToStaticMarkup(React.createElement(InspectionLocation, { inspection }));
  const html = render({ workflowStatus: "completed", capturedLocation: gps });
  assert.ok(html.includes("19.4326") && html.includes("-99.1332") && html.includes("12.5"));
  assert.match(html, /datetime="2026-10-09T12:00:00.000Z"/i);
  assert.ok(html.includes('href="https://www.google.com/maps?q=19.4326,-99.1332"'));
  assert.ok(html.includes('rel="noopener noreferrer"') && html.includes('referrerPolicy="no-referrer"'));
  assert.match(render({ workflowStatus: "completed", capturedLocation: null }), /No se registró ubicación GPS/);
  assert.equal(render({ workflowStatus: "completed" }), "", "technician DTO does not render GPS panel");
  assert.equal(render({ workflowStatus: "draft", capturedLocation: gps }), "", "draft never renders shared GPS");
  console.log("inspection-location.spec.ts: PASS");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
