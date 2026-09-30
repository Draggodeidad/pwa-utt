const assert = require("node:assert/strict");
const {
  validateInspectionDraft,
  validateInspectionForFinalization,
} = require("../src/features/inspections/schemas/inspection.schema.ts");
const { validateFindingForFinalization } = require("../src/features/findings/schemas/finding.schema.ts");
const { validateDomainOperation } = require("../src/features/sync/types.ts");
const {
  toInspectionDetailDto,
  toInspectionEditorDto,
  toInspectionListDto,
} = require("../src/features/inspections/selectors.ts");
const {
  findingFromApi,
  findingToApi,
} = require("../src/features/findings/types.ts");
const {
  inspectionFromApi,
  inspectionToApi,
} = require("../src/features/inspections/types.ts");

const ids = {
  inspection: "11111111-1111-4111-8111-111111111111",
  finding: "22222222-2222-4222-8222-222222222222",
  deletedFinding: "33333333-3333-4333-8333-333333333333",
  user: "44444444-4444-4444-8444-444444444444",
  laboratory: "55555555-5555-4555-8555-555555555555",
  operation: "66666666-6666-4666-8666-666666666666",
  client: "77777777-7777-4777-8777-777777777777",
};

assert.deepEqual(validateInspectionDraft({}), {}, "un borrador puede estar incompleto");
assert.throws(() => validateInspectionDraft({ inspectionDate: "2026-02-30" }), /real calendar date/);
assert.throws(() => validateInspectionDraft({ laboratoryId: ids.laboratory, extra: true }), /not allowed/);
assert.throws(() => validateInspectionForFinalization({ laboratoryId: ids.laboratory, inspectionDate: "2026-02-28", summary: "   " }), /between 1 and 4000/);
assert.throws(() => validateFindingForFinalization({ title: "  " }), /between 1 and 500/);
console.log("[ok] borradores incompletos y reglas de finalización se distinguen");

const createOperation = validateDomainOperation({
  clientId: ids.client,
  kind: "inspection.create",
  entityId: ids.inspection,
  payload: {},
});
assert.equal(createOperation.baseVersion, null, "las creaciones no tienen versión base");
const validOperations = [
  { kind: "inspection.update", payload: { summary: "Actualizada" } },
  { kind: "inspection.discard", payload: {} },
  { kind: "inspection.finalize", payload: { expectedFindingIds: [ids.finding] } },
  { kind: "finding.create", payload: { inspectionId: ids.inspection } },
  { kind: "finding.update", payload: { title: "Actualizado" } },
  { kind: "finding.delete", payload: {} },
  { kind: "finding.followup", payload: { status: "in_review" } },
];
for (const operation of validOperations) {
  const isCreation = operation.kind === "finding.create";
  const parsed = validateDomainOperation({
    clientId: ids.client,
    kind: operation.kind,
    entityId: ids.finding,
    ...(isCreation ? {} : { baseVersion: 1 }),
    payload: operation.payload,
  });
  assert.equal(parsed.kind, operation.kind);
  assert.equal(parsed.baseVersion, isCreation ? null : 1);
}
assert.throws(() => validateDomainOperation({
  clientId: ids.client,
  kind: "finding.update",
  entityId: ids.finding,
  baseVersion: 1,
  payload: { status: "resolved" },
}), /not allowed/, "la captura no acepta campos de seguimiento");
assert.throws(() => validateDomainOperation({
  clientId: ids.client,
  kind: "inspection.finalize",
  entityId: ids.inspection,
  baseVersion: 1,
  payload: { expectedFindingIds: ["not-a-uuid"] },
}), /must be a UUID/);
console.log("[ok] las ocho operaciones comparten estructura estricta y versiones correctas");

const inspection = {
  id: ids.inspection,
  folioNumber: 84,
  laboratoryId: ids.laboratory,
  inspectorId: ids.user,
  inspectionDate: "2026-02-28",
  summary: "Revisión de laboratorio",
  workflowStatus: "draft",
  updatedBy: ids.user,
  createdAt: "2026-02-28T10:00:00.000Z",
  updatedAt: "2026-02-28T10:00:00.000Z",
  version: 3,
  completedAt: null,
  deletedAt: null,
};

const activeResolvedFinding = {
  id: ids.finding,
  inspectionId: ids.inspection,
  title: "Contacto flojo",
  description: "Requiere ajuste",
  priority: "medium",
  status: "resolved",
  createdBy: ids.user,
  updatedBy: ids.user,
  createdAt: "2026-02-28T10:00:00.000Z",
  updatedAt: "2026-02-28T10:00:00.000Z",
  version: 2,
  resolvedAt: "2026-02-28T11:00:00.000Z",
  deletedAt: null,
};

const aggregate = {
  inspection,
  findings: [activeResolvedFinding, { ...activeResolvedFinding, id: ids.deletedFinding, deletedAt: "2026-02-28T12:00:00.000Z" }],
  laboratory: { code: "LAB-01", label: "Laboratorio 01" },
  inspectorName: "Técnica A",
  local: { syncStatus: "pending" },
};

const list = toInspectionListDto(aggregate);
const detail = toInspectionDetailDto(aggregate);
const editor = toInspectionEditorDto(aggregate);
assert.equal(list.id, ids.inspection);
assert.equal(list.folioNumber, 84, "el folio procede del servidor, no se genera en cliente");
assert.equal(list.findingCount, 1, "los eliminados no cuentan");
assert.equal(list.result, "requires_attention", "un hallazgo resuelto conserva requires_attention");
assert.equal(list.pendingFindingCount, 0, "los pendientes se calculan por separado");
assert.equal(detail.result, list.result);
assert.equal(editor.folioNumber, list.folioNumber);
assert.equal(editor.findings[0].id, ids.finding);
console.log("[ok] un agregado produce DTOs coherentes y selectores de conteo correctos");

const inspectionRoundTrip = inspectionFromApi(inspectionToApi(inspection));
const findingRoundTrip = findingFromApi(findingToApi(activeResolvedFinding));
assert.deepEqual(inspectionRoundTrip, inspection);
assert.deepEqual(findingRoundTrip, activeResolvedFinding);
console.log("[ok] los adaptadores snake_case/camelCase preservan las entidades");

console.log("domain-contracts.spec.ts: PASS");
