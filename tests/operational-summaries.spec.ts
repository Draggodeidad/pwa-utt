const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { listOperationalInspections, InspectionReadError } = require("../src/lib/repositories/inspections.ts");
const { createCoordinationDashboard } = require("../src/features/dashboard/data/coordination-dashboard.ts");
const { sortOperationalInspections, summarizeOperationalInspections } = require("../src/features/inspections/operational-summaries.ts");
const { mergeRemoteRefresh } = require("../src/features/inspections/services/local-capture.ts");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const COORDINATOR = "33333333-3333-4333-8333-333333333333";
const LAB = "44444444-4444-4444-8444-444444444444";
const id = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const row = (n, owner, status = "completed") => ({
  id: id(n), folio_number: n, laboratory_id: LAB, inspector_id: owner,
  inspection_date: n < 3 ? "2026-09-30" : "2026-09-29", summary: `Inspección ${n}`,
  workflow_status: status, version: 1, deleted_at: null,
});
const inspections = Array.from({ length: 101 }, (_, n) => row(n + 1, A, n === 100 ? "draft" : "completed"));
inspections.push(row(102, B));
inspections.push({ ...row(103, B), deleted_at: "2026-10-01T00:00:00Z" });
const findings = [
  { id: id(201), inspection_id: id(1), status: "resolved", deleted_at: null },
  { id: id(202), inspection_id: id(1), status: "resolved", deleted_at: null },
  { id: id(203), inspection_id: id(1), status: "pending", deleted_at: "2026-10-01T00:00:00Z" },
  { id: id(204), inspection_id: id(2), status: "in_review", deleted_at: null },
];
const laboratories = [{ id: LAB, code: "LAB", name: "Laboratorio" }];
const profiles = [{ id: A, display_name: "A" }, { id: B, display_name: "B" }];

function fakeClient(actor, role, failTable = null) {
  const visible = inspections.filter((inspection) => inspection.deleted_at === null && (role === "coordinator" ? inspection.workflow_status === "completed" : inspection.inspector_id === actor));
  const tables = { inspections: visible, findings: findings.filter((finding) => visible.some((inspection) => inspection.id === finding.inspection_id)), laboratories, profiles };
  return {
    from(table) {
      let rows = tables[table];
      const ordering = [];
      let limit = Infinity;
      const query = {
        select() { return query; },
        eq(key, value) { rows = rows.filter((item) => item[key] === value); return query; },
        is(key, value) { rows = rows.filter((item) => item[key] === value); return query; },
        in(key, values) { rows = rows.filter((item) => values.includes(item[key])); return query; },
        gt(key, value) { rows = rows.filter((item) => item[key] > value); return query; },
        or(expression) {
          const date = expression.match(/inspection_date\.lt\."([^"]+)"/)?.[1];
          const tiedId = expression.match(/id\.lt\.([0-9a-f-]+)/)?.[1];
          rows = rows.filter((item) => date
            ? item.inspection_date === null || item.inspection_date < date || (item.inspection_date === date && item.id < tiedId)
            : item.inspection_date === null && item.id < tiedId);
          return query;
        },
        order(key, options = {}) { ordering.push([key, options]); return query; },
        limit(value) { limit = value; return query; },
        then(resolve, reject) {
          if (table === failTable) return Promise.resolve({ data: null, error: { message: "unavailable" } }).then(resolve, reject);
          const sorted = [...rows].sort((left, right) => {
            for (const [key, options] of ordering) {
              const a = left[key], b = right[key];
              if (a === b) continue;
              if (a === null) return 1;
              if (b === null) return -1;
              return (a < b ? -1 : 1) * (options.ascending === false ? -1 : 1);
            }
            return 0;
          });
          return Promise.resolve({ data: sorted.slice(0, limit), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

async function main() {
  for (const page of ["src/app/page.tsx", "src/app/dashboard/page.tsx", "src/app/inspections/page.tsx"]) {
    const source = readFileSync(resolve(__dirname, "..", page), "utf8");
    assert.match(source, /requireRole\(/, `${page} verifica el rol en SSR`);
    assert.match(source, /listOperationalInspections\(/, `${page} llama directamente al servicio autorizado`);
    assert.doesNotMatch(source, /fetch\(/, `${page} no hace HTTP a sí misma`);
  }
  const own = await listOperationalInspections(fakeClient(A, "technician"), { role: "technician", userId: A });
  const other = await listOperationalInspections(fakeClient(B, "technician"), { role: "technician", userId: B });
  const coordination = await listOperationalInspections(fakeClient(COORDINATOR, "coordinator"), { role: "coordinator", userId: COORDINATOR });
  assert.equal(own.length, 101, "la consulta recorre más de una página de 100");
  assert.equal(other.length, 1, "otra cuenta no recibe inspecciones ajenas");
  assert.equal(coordination.length, 101, "coordinación ve solo las finalizadas no eliminadas");
  assert.equal(coordination.every((item) => item.workflowStatus === "completed"), true);
  assert.equal(own.find((item) => item.id === id(1)).findingCount, 2, "resueltos sí cuentan en resultado histórico; eliminado no");
  assert.equal(own.find((item) => item.id === id(1)).pendingFindingCount, 0);
  assert.equal(own.find((item) => item.id === id(1)).result, "requires_attention");
  assert.equal(own.find((item) => item.id === id(2)).pendingFindingCount, 1);

  const dashboard = createCoordinationDashboard(coordination);
  assert.equal(dashboard.summary.inspectionCount, 101);
  assert.equal(dashboard.summary.inspectionCountRequiringAttention, 2);
  assert.equal(dashboard.summary.findingCount, 3);
  assert.equal(dashboard.summary.pendingFindingCount, 1);
  assert.equal(dashboard.summary.pendingFindingCount, summarizeOperationalInspections(coordination).pendingFindingCount, "SSR y selector cliente comparten el mismo universo");
  assert.equal(dashboard.recentInspections[0].id, id(2), "empate por fecha desempata UUID descendente");
  assert.equal(dashboard.recentInspections[1].id, id(1));
  assert.deepEqual(createCoordinationDashboard([]).summary, { inspectionCount: 0, inspectionCountRequiringAttention: 0, findingCount: 0, pendingFindingCount: 0 });

  const localDraft = { ...own[0], id: id(999), workflowStatus: "draft", syncStatus: "pending", findingCount: 3, pendingFindingCount: 3, result: "requires_attention" };
  const pendingCopy = { ...own[0], syncStatus: "pending", summary: "Edición local" };
  const merged = mergeRemoteRefresh([localDraft, pendingCopy], own);
  assert.equal(merged.length, 102, "la copia local de la entidad remota no se duplica");
  assert.equal(merged.find((item) => item.id === pendingCopy.id).summary, "Edición local", "el refresco conserva pendientes");
  assert.equal(summarizeOperationalInspections(merged).completedCount, 100, "borrador local no aumenta completadas remotas");
  assert.equal(summarizeOperationalInspections(merged).syncPendingCount, 2);
  assert.deepEqual(sortOperationalInspections([own[0], own[1]]).map((item) => item.id), [id(2), id(1)]);
  const extraFindings = Array.from({ length: 1000 }, (_, n) => ({ id: id(300 + n), inspection_id: id(1), status: "resolved", deleted_at: null }));
  findings.push(...extraFindings);
  const large = await listOperationalInspections(fakeClient(A, "technician"), { role: "technician", userId: A });
  assert.equal(large.find((item) => item.id === id(1)).findingCount, 1002, "el conteo recorre más de 1000 hallazgos");
  assert.equal(large.find((item) => item.id === id(1)).pendingFindingCount, 0);
  findings.splice(findings.length - extraFindings.length);
  await assert.rejects(listOperationalInspections(fakeClient(A, "technician", "findings"), { role: "technician", userId: A }), InspectionReadError);
  console.log("operational-summaries.spec.ts: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
