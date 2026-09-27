// tests/rendering.spec.ts
// Suite de pruebas de renderizado CSR/SSR, datos sintéticos y estados de carga/error (Semana 04 - HU #28)

require.extensions[".ts"] = require.extensions[".js"];

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  const fullPath = path.resolve(root, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf8");
}

function runRenderingSuite() {
  console.log("Iniciando suite de pruebas de renderizado (tests/rendering.spec.ts)...\n");

  // ---------------------------------------------------------------------------
  // 1. Verificación de existencia de rutas y componentes
  // ---------------------------------------------------------------------------
  console.log("  [1] Verificación de estructura y rutas de inspecciones...");
  const officialListPath = "src/app/inspecciones/page.tsx";
  const officialDetailPath = "src/app/inspecciones/[id]/page.tsx";
  const officialLoadingPath = "src/components/loading-state.tsx";

  const fallbackListPath = "src/app/inspections/page.tsx";
  const fallbackDetailPath = "src/app/inspections/[inspectionId]/page.tsx";
  const fallbackLoadingPath = "src/app/loading.tsx";

  const hasOfficialRoutes = fs.existsSync(path.resolve(root, officialListPath));
  const hasFallbackRoutes = fs.existsSync(path.resolve(root, fallbackListPath));

  assert.ok(
    hasOfficialRoutes || hasFallbackRoutes,
    `Error de contrato: no se encontró ninguna ruta de listado de inspecciones ni en ${officialListPath} ni en ${fallbackListPath}`
  );

  const activeListPath = hasOfficialRoutes ? officialListPath : fallbackListPath;
  const activeDetailPath = hasOfficialRoutes ? officialDetailPath : fallbackDetailPath;
  const activeLoadingPath = fs.existsSync(path.resolve(root, officialLoadingPath))
    ? officialLoadingPath
    : fallbackLoadingPath;

  console.log(`      Ruta de listado activa: ${activeListPath}`);
  console.log(`      Ruta de detalle activa: ${activeDetailPath}`);
  console.log(`      Componente de carga activo: ${activeLoadingPath}`);

  // ---------------------------------------------------------------------------
  // 2. Estrategia de renderizado CSR vs SSR
  // ---------------------------------------------------------------------------
  console.log("  [2] Comprobación de la estrategia de renderizado (CSR vs SSR)...");
  const listCode = readProjectFile(activeListPath);
  const detailCode = readProjectFile(activeDetailPath);
  const decisionDoc = readProjectFile("docs/rendering-decision.md");

  assert.ok(listCode, `No se pudo leer el archivo de listado en ${activeListPath}`);
  assert.ok(detailCode, `No se pudo leer el archivo de detalle en ${activeDetailPath}`);

  // Verificar directiva 'use client'
  const isListClient = listCode.includes('"use client"') || listCode.includes("'use client'");
  const isDetailClient = detailCode.includes('"use client"') || detailCode.includes("'use client'");

  if (decisionDoc) {
    console.log("      docs/rendering-decision.md encontrado; validando coherencia...");
    const mentionsSSR = /SSR|Server-Side|servidor/i.test(decisionDoc);
    const mentionsCSR = /CSR|Client-Side|cliente/i.test(decisionDoc);
    assert.ok(mentionsSSR && mentionsCSR, "docs/rendering-decision.md debe comparar tanto CSR como SSR");
  } else {
    console.log("      [Aviso] docs/rendering-decision.md pendiente de integración desde issue #29.");
  }

  console.log(`      Listado: ${isListClient ? "Client Component (CSR)" : "Server Component (SSR)"}`);
  console.log(`      Detalle: ${isDetailClient ? "Client Component (CSR)" : "Server Component (SSR)"}`);

  // ---------------------------------------------------------------------------
  // 3. Renderizado y consumo de datos sintéticos en el listado
  // ---------------------------------------------------------------------------
  console.log("  [3] Validación de datos sintéticos en el listado...");
  const inspectionsContent = readProjectFile("src/features/inspections/data/inspections.ts");
  assert.ok(inspectionsContent, "El archivo de datos sintéticos de inspecciones debe existir");

  // Extraer IDs sintéticos del archivo fuente
  const idMatches = [];
  const idRegex = /id:\s*"([^"]+)"/g;
  let m;
  while ((m = idRegex.exec(inspectionsContent)) !== null) {
    idMatches.push(m[1]);
  }

  assert.ok(idMatches.length >= 3, "Deben existir al menos 3 inspecciones sintéticas registradas");
  assert.ok(idMatches.includes("inspection-001"), "Debe incluir la inspección sintética 'inspection-001'");
  assert.ok(idMatches.includes("inspection-003"), "Debe incluir la inspección sintética 'inspection-003'");

  // Validar contrato de campos reales de las inspecciones sintéticas
  assert.match(inspectionsContent, /location:\s*"Laboratorio de Cómputo/);
  assert.match(inspectionsContent, /laboratoryCode:\s*"LAB-COMP-/);
  assert.match(inspectionsContent, /date:\s*"2026-/);
  assert.match(inspectionsContent, /result:\s*"(without_findings|requires_attention)"/);
  assert.match(inspectionsContent, /workflowStatus:\s*"(completed|draft)"/);

  // Verificar que el listado importe y utilice los datos sintéticos
  assert.match(
    listCode,
    /inspections/,
    "La página de listado debe importar o consumir la colección de datos sintéticos de inspecciones"
  );

  // ---------------------------------------------------------------------------
  // 4. Detalle con ID válido real
  // ---------------------------------------------------------------------------
  console.log("  [4] Validación de resolución de detalle con ID válido...");
  const validId = idMatches[0]; // "inspection-001"
  assert.ok(validId, "Debe existir al menos un ID válido en los datos sintéticos");

  assert.match(
    detailCode,
    /params(\.inspectionId|\.id)/,
    "La vista de detalle debe leer el identificador recibido en params"
  );
  assert.match(
    detailCode,
    /inspections\.find|inspectionDetail/,
    "La vista de detalle debe resolver la inspección a partir de la colección de datos sintéticos"
  );

  // ---------------------------------------------------------------------------
  // 5. Detalle con ID inexistente (comportamiento de fallback / notFound)
  // ---------------------------------------------------------------------------
  console.log("  [5] Comportamiento del detalle ante identificador inexistente...");
  const nonExistentId = "inspection-inexistente-999";
  assert.ok(!idMatches.includes(nonExistentId), "El ID de prueba inexistente no debe existir en los datos sintéticos");

  assert.match(
    detailCode,
    /notFound\s*\(\)/,
    "La página de detalle debe invocar notFound() ante un identificador inexistente"
  );

  // ---------------------------------------------------------------------------
  // 6. Validación del estado de carga (Loading State y Accesibilidad)
  // ---------------------------------------------------------------------------
  console.log("  [6] Validación de accesibilidad y estructura en estado de carga...");
  const loadingFileContent = readProjectFile(activeLoadingPath);
  const appShellContent = readProjectFile("src/components/app-shell.tsx");
  assert.ok(loadingFileContent || appShellContent, "Debe existir componente o boundary para estados de carga");

  const combinedLoadingCode = (loadingFileContent || "") + (appShellContent || "");

  // Verificar atributos de accesibilidad para lectores de pantalla
  const hasAriaBusy = /aria-busy=["']true["']/.test(combinedLoadingCode);
  const hasAriaLive = /aria-live=["'](polite|assertive)["']/.test(combinedLoadingCode);
  const hasRoleStatus = /role=["'](status|alert)["']/.test(combinedLoadingCode);

  assert.ok(
    hasAriaBusy || hasAriaLive || hasRoleStatus,
    "El componente de estado de carga debe incluir atributos accesibles (aria-busy, aria-live o role='status')"
  );

  // ---------------------------------------------------------------------------
  // 7. Validación de estados de error y vacío (Empty / Error State)
  // ---------------------------------------------------------------------------
  console.log("  [7] Comprobación de estados de error y vacío...");
  const errorPageContent = readProjectFile("src/app/error.tsx");
  assert.ok(errorPageContent || appShellContent, "Debe existir soporte para boundary de error");

  const combinedErrorCode = (errorPageContent || "") + (appShellContent || "");
  assert.match(
    combinedErrorCode,
    /error|alert|reintentar|retry/i,
    "El manejo de estados debe contemplar retroalimentación visual ante errores"
  );

  console.log("\ntests/rendering.spec.ts: PASS\n");
}

try {
  runRenderingSuite();
} catch (error) {
  console.error("\nFallo en tests/rendering.spec.ts:", error);
  process.exit(1);
}
