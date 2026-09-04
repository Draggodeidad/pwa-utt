import assert from "node:assert/strict";
import { inspections, getInspectionStatusLabel, validateInspection } from "../src/lib/data/inspections.ts";

// Test 1: Verificar que la función de etiquetado devuelve la etiqueta correcta según el estado y hallazgos
for (const inspection of inspections) {
  const label = getInspectionStatusLabel(inspection);
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

// Test 2: Validador de consistencia de inspecciones sintéticas
for (const inspection of inspections) {
  const result = validateInspection(inspection);
  assert.equal(
    result.valid,
    true,
    `Inspección inválida detectada en ${inspection.id}: ${result.error}`
  );
}

console.log("inspections.spec.mjs: PASS");
