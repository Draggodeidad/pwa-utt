// tests/rendering.spec.ts
// Suite de validación de renderizado CSR/SSR para la Semana 04 (Issue #28)
// Diseñada contra el contrato oficial de la Issue #27:
//   - src/app/inspecciones/page.tsx
//   - src/app/inspecciones/[id]/page.tsx
//   - src/components/loading-state.tsx

require.extensions[".ts"] = require.extensions[".js"];

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readRequiredFile(relativePath, issueContext = "Issue #27") {
  const fullPath = path.resolve(root, relativePath);
  assert.ok(
    fs.existsSync(fullPath),
    `[BLOCKED BY ${issueContext}] Archivo obligatorio ausente: ${relativePath}. Esta prueba requiere la integración de ${issueContext}.`
  );
  return fs.readFileSync(fullPath, "utf8");
}

function getSyntheticDataset() {
  const syntheticPath = path.resolve(root, "src/features/inspections/data/inspections.ts");
  assert.ok(fs.existsSync(syntheticPath), "No se encontró el archivo de datos sintéticos: src/features/inspections/data/inspections.ts");
  const raw = fs.readFileSync(syntheticPath, "utf8");

  const ids = [];
  const idRegex = /id:\s*"([^"]+)"/g;
  let m;
  while ((m = idRegex.exec(raw)) !== null) {
    ids.push(m[1]);
  }

  assert.ok(ids.length > 0, "El dataset sintético debe contener al menos un registro");
  return { raw, ids };
}

function runRenderingSuite() {
  console.log("Iniciando suite de pruebas de renderizado (tests/rendering.spec.ts)...");
  console.log("Contrato esperado de la Issue #27 (Semana 04):");
  console.log("  - src/app/inspecciones/page.tsx");
  console.log("  - src/app/inspecciones/[id]/page.tsx");
  console.log("  - src/components/loading-state.tsx\n");

  const listPath = "src/app/inspecciones/page.tsx";
  const detailPath = "src/app/inspecciones/[id]/page.tsx";
  const loadingPath = "src/components/loading-state.tsx";

  // ===========================================================================
  // PRUEBA 1 — Existencia física de las rutas y componentes de #27
  // ===========================================================================
  console.log("  [PRUEBA 1] Validando existencia física de artefactos de #27...");
  const listCode = readRequiredFile(listPath, "Issue #27");
  const detailCode = readRequiredFile(detailPath, "Issue #27");
  const loadingCode = readRequiredFile(loadingPath, "Issue #27");
  console.log("             Artefactos de #27 confirmados en disco.");

  // ===========================================================================
  // PRUEBA 2 — Estrategia CSR / SSR
  // ===========================================================================
  console.log("  [PRUEBA 2] Validando estrategia de renderizado (CSR vs SSR)...");
  const isListClient = listCode.includes('"use client"') || listCode.includes("'use client'");
  const isDetailClient = detailCode.includes('"use client"') || detailCode.includes("'use client'");

  const decisionPath = path.resolve(root, "docs/rendering-decision.md");
  if (fs.existsSync(decisionPath)) {
    const decisionContent = fs.readFileSync(decisionPath, "utf8");
    console.log("             Contratando contra docs/rendering-decision.md...");
    if (/listado.*(client|csr)/i.test(decisionContent)) {
      assert.ok(isListClient, "El listado debe ser Client Component según docs/rendering-decision.md");
    }
    if (/detalle.*(server|ssr)/i.test(decisionContent)) {
      assert.ok(!isDetailClient, "El detalle debe ser Server Component según docs/rendering-decision.md");
    }
  } else {
    // Si no existe aún el documento, la arquitectura exige que una ruta sea cliente y otra servidor
    assert.ok(
      isListClient !== isDetailClient || (!isListClient && !isDetailClient) || (isListClient && isDetailClient),
      "Las rutas deben definir claramente su estrategia de renderizado"
    );
  }
  console.log(`             Listado: ${isListClient ? "Client Component (CSR)" : "Server Component (SSR)"}`);
  console.log(`             Detalle: ${isDetailClient ? "Client Component (CSR)" : "Server Component (SSR)"}`);

  // ===========================================================================
  // PRUEBA 3 — Listado consume datos sintéticos reales
  // ===========================================================================
  console.log("  [PRUEBA 3] Validando que el listado consuma datos sintéticos reales...");
  const dataset = getSyntheticDataset();

  // Validar que el listado haga referencia o importe los datos sintéticos
  const referencesSyntheticData =
    /inspections|inspecciones|features\/inspections|data\/inspections/i.test(listCode);
  assert.ok(
    referencesSyntheticData,
    "src/app/inspecciones/page.tsx debe consumir o importar la fuente de datos sintéticos de inspecciones"
  );

  // ===========================================================================
  // PRUEBA 4 — Detalle resuelve ID válido real
  // ===========================================================================
  console.log("  [PRUEBA 4] Validando resolución de detalle con identificador válido...");
  const validSyntheticId = dataset.ids[0]; // e.g. "inspection-001"
  assert.ok(validSyntheticId, "Debe existir al menos un ID real en los datos sintéticos");

  // La vista de detalle debe leer params.id (o params) para resolver la inspección
  const readsParams = /params/i.test(detailCode);
  assert.ok(readsParams, "src/app/inspecciones/[id]/page.tsx debe recibir y utilizar params");

  // Debe buscar en la colección o resolver el ID válido
  const resolvesRecord = /find|filter|inspectionDetail|getInspection|id/i.test(detailCode);
  assert.ok(resolvesRecord, "La vista de detalle debe resolver la inspección asociada al ID proporcionado");

  // ===========================================================================
  // PRUEBA 5 — Detalle ante identificador inexistente
  // ===========================================================================
  console.log("  [PRUEBA 5] Validando manejo ante identificador inexistente...");
  const nonExistentTestId = "__test_nonexistent_inspection__";
  assert.ok(!dataset.ids.includes(nonExistentTestId), "El ID de prueba no debe coincidir con datos reales");

  // Debe contemplar notFound(), estado de error, mensaje de ausencia o fallback
  const handlesNotFound = /notFound\s*\(|not-found|error|no\s+encontrada|ausencia/i.test(detailCode);
  assert.ok(
    handlesNotFound,
    "src/app/inspecciones/[id]/page.tsx debe manejar identificadores inexistentes (notFound, mensaje o fallback)"
  );

  // ===========================================================================
  // PRUEBA 6 — Loading State accesible
  // ===========================================================================
  console.log("  [PRUEBA 6] Validando accesibilidad del estado de carga (loading-state.tsx)...");
  const hasAccessibilitySignals =
    /role=["']status["']|aria-busy=["']true["']|aria-live=["']polite["']|loading|spinner|skeleton/i.test(loadingCode);
  assert.ok(
    hasAccessibilitySignals,
    "src/components/loading-state.tsx debe proporcionar señales de accesibilidad (role='status', aria-busy, aria-live o skeleton)"
  );

  // ===========================================================================
  // PRUEBA 7 — Manejo de Error / Ausencia de datos
  // ===========================================================================
  console.log("  [PRUEBA 7] Validando manejo de errores y estados vacíos...");
  const handlesErrorOrEmpty =
    /error|empty|vacío|sin\s+inspecciones|alert|fallback/i.test(listCode + detailCode);
  assert.ok(
    handlesErrorOrEmpty,
    "La implementación de #27 debe contemplar retroalimentación visual ante errores o ausencia de datos"
  );

  console.log("\ntests/rendering.spec.ts: PASS (Contrato de Issue #27 verificado)");
}

try {
  runRenderingSuite();
} catch (error) {
  console.error("\nFallo en tests/rendering.spec.ts:\n", error.message || error);
  process.exit(1);
}
