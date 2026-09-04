import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");

// Cargar y transpilar src/lib/data/inspections.ts compatible con Node 18, 20 LTS y 22 sin flags experimentales
const tsCode = await readFile(resolve(root, "src/lib/data/inspections.ts"), "utf8");
const { outputText } = ts.transpileModule(tsCode, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { inspections, getInspectionStatusLabel, validateInspection } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);

// Cargar src/app/page.tsx para verificar el consumo de la función en la interfaz visual
const pageContent = await readFile(resolve(root, "src/app/page.tsx"), "utf8");

// Test 1: Verificar que la aplicación en producción (page.tsx) consume la función getInspectionStatusLabel
assert.match(
  pageContent,
  /getInspectionStatusLabel/,
  "La interfaz (src/app/page.tsx) debe importar y utilizar getInspectionStatusLabel en lugar de leer propiedades duplicadas"
);

// Test 2: Verificar inmutabilidad y etiquetas dinámicas según el estado y hallazgos
for (const inspection of inspections) {
  const inspectionCopy = { ...inspection };
  const label = getInspectionStatusLabel(inspection);

  // Verificar que getInspectionStatusLabel no muta el objeto original
  assert.deepEqual(
    inspection,
    inspectionCopy,
    `Llamar a getInspectionStatusLabel mutó la inspección ${inspection.id}`
  );

  if (inspection.status === "attention") {
    assert.equal(
      label,
      "Requiere atención",
      `Estado incorrecto para ${inspection.id}: se esperaba 'Requiere atención' pero se obtuvo '${label}'`
    );
  } else {
    assert.equal(
      label,
      "Sin incidencias",
      `Estado incorrecto para ${inspection.id}: se esperaba 'Sin incidencias' pero se obtuvo '${label}'`
    );
  }
}

// Test 3: Validador de consistencia de inspecciones sintéticas
for (const inspection of inspections) {
  const result = validateInspection(inspection);
  assert.equal(
    result.valid,
    true,
    `Inspección inválida detectada en ${inspection.id}: ${result.error}`
  );
}

// Test 4: Caso de prueba de regresión para evitar el bug de asignación de estado
const testAttention = {
  id: "inspection-test-attention",
  location: "Lab Test",
  date: "2026-09-04",
  inspector: "Inspector Test",
  status: "attention",
  statusLabel: "Requiere atención",
  findings: 1,
  summary: "Test de regresión"
};
const labelOutput = getInspectionStatusLabel(testAttention);
assert.equal(labelOutput, "Requiere atención", "Inspecciones con status 'attention' deben retornar 'Requiere atención'");
assert.equal(testAttention.status, "attention", "getInspectionStatusLabel no debe mutar status a 'ok'");

console.log("inspections.spec.mjs: PASS");
