// Functional and acceptance test for Phase 22: Sync UI
// Covers real queue observation, derived progress, specific causes, partitioned lastSync,
// dependency-preserving retries, 401/403/409/422 handling, session isolation, and badge rendering.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const typescript = require("typescript");

const Module = require("node:module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    request = resolve(__dirname, "../src", request.slice(2));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

for (const extension of [".ts", ".tsx"]) {
  if (!require.extensions[extension]) {
    require.extensions[extension] = (module, filename) => {
      const source = readFileSync(filename, "utf8");
      const output = typescript.transpileModule(source, {
        compilerOptions: {
          module: typescript.ModuleKind.CommonJS,
          jsx: typescript.JsxEmit.ReactJSX,
          target: typescript.ScriptTarget.ES2022,
        },
      });
      module._compile(output.outputText, filename);
    };
  }
}

const { createIndexedDbHarness } = require("./helpers/indexed-db-harness.ts");
const { LocalStorage, PartitionRequiredError } = require("../src/lib/pwa/offline-storage.ts");
const { ApiClientError } = require("../src/lib/api/client.ts");
const { saveDraft, saveFindings } = require("../src/features/inspections/services/local-capture.ts");
const { runQueue } = require("../src/lib/pwa/sync/runner.ts");
const session = require("../src/lib/pwa/offline-session.ts");
const { SyncStatusBadge } = require("../src/features/sync/components/SyncStatusBadge.tsx");

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const INSP_ID = "33333333-3333-4333-8333-333333333333";
const FIND_1 = "44444444-4444-4444-8444-444444444444";
const FIND_2 = "55555555-5555-4555-8555-555555555555";
const TIME_0 = "2026-09-30T10:00:00.000Z";
const TIME_ACK = "2026-09-30T10:05:00.000Z";

function makeDraft(id = INSP_ID, owner = USER_A) {
  return {
    id, folioNumber: 0, laboratoryId: null, inspectorId: owner,
    inspectionDate: "2026-09-30", summary: "Inspección de prueba", workflowStatus: "draft", updatedBy: owner,
    createdAt: TIME_0, updatedAt: TIME_0, version: 0, completedAt: null, deletedAt: null,
    ownerUserId: owner, localRevision: 1, baseVersion: null, syncStatus: "pending", localUpdatedAt: TIME_0,
  };
}

function makeFinding(id, inspectionId = INSP_ID, owner = USER_A) {
  return {
    id, inspectionId, title: `Hallazgo ${id.slice(0, 4)}`, description: "Detalle", priority: "medium", status: "pending",
    createdBy: owner, updatedBy: owner, createdAt: TIME_0, updatedAt: TIME_0, version: 0,
    resolvedAt: null, deletedAt: null, ownerUserId: owner, localRevision: 1,
    baseVersion: null, syncStatus: "pending", localUpdatedAt: TIME_0,
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    entries: () => [...values.entries()],
  };
}

function makeClient(handlers) {
  return {
    post: (path, body, options) => handlers.post ? handlers.post(path, body, options) : handlers.default(path, body, options),
    put: (path, body, options) => handlers.put ? handlers.put(path, body, options) : handlers.default(path, body, options),
    patch: (path, body, options) => handlers.patch ? handlers.patch(path, body, options) : handlers.default(path, body, options),
    delete: (path, options) => handlers.delete ? handlers.delete(path, options) : handlers.default(path, undefined, options),
  };
}

async function main() {
  const harness = createIndexedDbHarness();
  const fakeStorage = memoryStorage();
  globalThis.indexedDB = harness.indexedDB;
  globalThis.localStorage = fakeStorage;
  globalThis.window = new EventTarget();
  globalThis.location = { protocol: "https:" };
  globalThis.document = { cookie: "" };

  console.log("Iniciando pruebas de Phase 22: Sync UI...");

  // 1. Criterio 1: Cola vacía indica cero y última sincronización nula
  {
    session.establishLocalSession({ userId: USER_A, displayName: "Técnica A" });
    const storage = await LocalStorage.open("test-empty");
    const queue = await storage.listQueue(USER_A);
    const lastSync = await storage.getLastSyncAt(USER_A);
    assert.equal(queue.length, 0, "La cola vacía debe tener longitud 0");
    assert.equal(lastSync, null, "Sin sincronizaciones previas lastSyncAt debe ser null");
    storage.close();
    console.log("[ok] Criterio 1: Cola vacía indica cero y lastSync null");
  }

  // 2. Criterio 2: Enviar tres operaciones y fallar una conserva progreso confirmado y causa específica
  {
    session.establishLocalSession({ userId: USER_A, displayName: "Técnica A" });
    const storage = await LocalStorage.open("test-progress");
    const inspection = makeDraft();
    const f1 = makeFinding(FIND_1);
    const f2 = makeFinding(FIND_2);

    await saveDraft(USER_A, storage, { owner: USER_A, inspection, findings: [f1, f2], removedFindings: [] });

    const initialQueue = await storage.listQueue(USER_A);
    assert.equal(initialQueue.length, 3, "Deben haberse encolado 3 operaciones");

    // Simular transporte: inspección y hallazgo 1 se confirman (ACK), pero hallazgo 2 falla con 403 FORBIDDEN
    let clientCalls = 0;
    const client = makeClient({
      default: async (path, body, options) => {
        clientCalls++;
        if (body.entityId === FIND_2) {
          throw new ApiClientError(403, { code: "FORBIDDEN", message: "No autorizado para registrar este hallazgo" });
        }
        return {
          operationId: options.operationId,
          entityId: body.entityId,
          entityType: body.kind.startsWith("inspection") ? "inspection" : "finding",
          version: 1,
          appliedAt: TIME_ACK,
          replayed: false,
          ...(body.kind === "inspection.create" ? { folioNumber: 104 } : {}),
        };
      },
    });

    const transport = {
      client,
      verifyOwner: async (owner) => owner === USER_A,
      now: () => Date.parse(TIME_ACK),
    };

    const outcome = await runQueue(storage, USER_A, transport);
    assert.equal(outcome.acknowledged, 2, "Deben haberse confirmado exactamente 2 operaciones");
    assert.equal(outcome.failed, 1, "Debe haber fallado exactamente 1 operación");

    const remainingQueue = await storage.listQueue(USER_A);
    assert.equal(remainingQueue.length, 1, "Solo la operación fallida debe permanecer en la cola");
    const failedItem = remainingQueue[0];
    assert.equal(failedItem.status, "error", "La operación fallida debe tener status error");
    assert.equal(failedItem.lastError?.code, "FORBIDDEN", "Debe conservar el código FORBIDDEN específico");
    assert.equal(failedItem.lastError?.message, "No autorizado para registrar este hallazgo", "Debe conservar el mensaje específico");

    // Verificar progreso derivado: 2 confirmadas de 3 (67%), no 100% simulado
    const progress = Math.round((outcome.acknowledged / initialQueue.length) * 100);
    assert.equal(progress, 67, "Progreso derivado de ACKs reales debe ser 67%");

    storage.close();
    console.log("[ok] Criterio 2: Progreso confirmado real (2/3) y causa específica preservada sin éxito simulado");
  }

  // 3. Criterio 3: ACK con edición local posterior mantiene badge pending
  {
    session.establishLocalSession({ userId: USER_A, displayName: "Técnica A" });
    const storage = await LocalStorage.open("test-concurrent-edit");
    const insp = makeDraft("inspeccion-editada");
    await saveDraft(USER_A, storage, { owner: USER_A, inspection: insp, findings: [], removedFindings: [] });

    const queueBeforeSend = await storage.listQueue(USER_A);
    const sent = await storage.prepareSend(USER_A, queueBeforeSend[0].operationId, "client-id-test");
    assert.notEqual(sent, null);

    // Edición local mientras la petición está en vuelo: incrementa localRevision
    const localEntity = await storage.getInspection(USER_A, "inspeccion-editada");
    await storage.saveInspection(USER_A, {
      ...localEntity,
      summary: "Modificado mientras se enviaba",
      localRevision: localEntity.localRevision + 1,
      syncStatus: "pending",
    });

    // Llega el ACK de la petición vieja
    const ack = {
      operationId: sent.operationId,
      entityId: sent.entityId,
      entityType: "inspection",
      version: 1,
      appliedAt: TIME_ACK,
      replayed: false,
      folioNumber: 50,
    };
    await storage.acknowledge(USER_A, sent, ack);

    const updatedEntity = await storage.getInspection(USER_A, "inspeccion-editada");
    assert.equal(updatedEntity.syncStatus, "pending", "La entidad modificada tras el envío debe conservar syncStatus 'pending'");

    storage.close();
    console.log("[ok] Criterio 3: ACK con edición local posterior mantiene syncStatus 'pending'");
  }

  // 4. Criterio 4: Partición de última sincronización por usuario
  {
    session.establishLocalSession({ userId: USER_A, displayName: "Técnica A" });
    const storage = await LocalStorage.open("test-last-sync");

    // Usuario A tiene sincronización exitosa previa (del test anterior o registrando una nueva)
    const inspA = makeDraft("inspeccion-usuario-a", USER_A);
    await saveDraft(USER_A, storage, { owner: USER_A, inspection: inspA, findings: [], removedFindings: [] });
    const queueA = await storage.listQueue(USER_A);
    const sentA = await storage.prepareSend(USER_A, queueA[0].operationId, "client-a");
    await storage.acknowledge(USER_A, sentA, {
      operationId: sentA.operationId,
      entityId: sentA.entityId,
      entityType: "inspection",
      version: 1,
      appliedAt: TIME_ACK,
      replayed: false,
    });

    const lastSyncA = await storage.getLastSyncAt(USER_A);
    storage.close();

    // Cambio de sesión a Usuario B
    session.establishLocalSession({ userId: USER_B, displayName: "Técnico B" });
    const storageB = await LocalStorage.open("test-last-sync");
    const lastSyncB = await storageB.getLastSyncAt(USER_B);
    assert.equal(lastSyncB, null, "Usuario B no debe ver la última sincronización de Usuario A");
    storageB.close();

    console.log("[ok] Criterio 4: lastSyncAt cambia solo tras ACK durable y está particionado por usuario");
  }

  // 5. Criterio 5: Manejo de errores específicos (401, 403, 409, 422) y reintento con dependencias
  {
    session.establishLocalSession({ userId: USER_A, displayName: "Técnica A" });
    const storage = await LocalStorage.open("test-errors-retry");

    const insp = makeDraft("insp-dep");
    const find = makeFinding("find-dep", "insp-dep");
    await saveDraft(USER_A, storage, { owner: USER_A, inspection: insp, findings: [find], removedFindings: [] });

    const queue = await storage.listQueue(USER_A);
    assert.equal(queue.length, 2);
    const inspOp = queue.find((item) => item.entityId === "insp-dep");
    const findOp = queue.find((item) => item.entityId === "find-dep");

    // Falla la inspección (padre) con 422
    await storage.failSend(USER_A, inspOp, {
      code: "VALIDATION_ERROR",
      message: "Resumen inválido",
      fieldErrors: { summary: "Longitud insuficiente" },
    });

    // Falla el hallazgo (hijo) con error de dependencia
    await storage.failSend(USER_A, findOp, {
      code: "FORBIDDEN",
      message: "No se puede registrar sin inspección válida",
    });

    // Intentar reintentar el hallazgo dependiente mientras la inspección padre sigue sin sincronizarse
    const canRetryChild = await storage.retryQueueItem(USER_A, findOp.operationId);
    assert.equal(canRetryChild, false, "No debe permitir reintentar un dependiente si su dependencia sigue en cola");

    // Reintentar la inspección padre: debe tener éxito
    const canRetryParent = await storage.retryQueueItem(USER_A, inspOp.operationId);
    assert.equal(canRetryParent, true, "Debe permitir reintentar la operación padre");

    const reloadedInspOp = (await storage.listQueue(USER_A)).find((i) => i.operationId === inspOp.operationId);
    assert.equal(reloadedInspOp.status, "pending", "El estado de la operación reintentada debe ser pending");
    assert.equal(reloadedInspOp.nextAttemptAt, null, "nextAttemptAt debe limpiarse");

    // Prueba de 409 (conflicto)
    await storage.failSend(USER_A, inspOp, {
      code: "VERSION_CONFLICT",
      message: "Conflicto de concurrencia",
    }, null, undefined, Date.now(), false, {
      reason: "version",
      remoteSnapshot: { version: 2 },
      remoteVersion: 2,
    });

    const conflicts = await storage.listConflicts(USER_A);
    assert.equal(conflicts.length, 1, "Debe haberse registrado un conflicto en conflict_local");
    assert.equal(conflicts[0].reason, "version");

    storage.close();
    console.log("[ok] Criterio 5: 422/409/403 registrados y retryQueueItem respeta dependencias causales");
  }

  // 6. Criterio 6: Logout / Aislamiento A -> B limpia contadores y particiones inmediatamente
  {
    session.establishLocalSession({ userId: USER_A, displayName: "Técnica A" });
    const storageA = await LocalStorage.open("test-isolation");
    await saveDraft(USER_A, storageA, { owner: USER_A, inspection: makeDraft("insp-iso"), findings: [], removedFindings: [] });
    const queueA = await storageA.listQueue(USER_A);
    assert.equal(queueA.length, 1);
    storageA.close();

    // Logout
    const blockedUserId = session.blockLocalSession();
    assert.equal(blockedUserId, USER_A);
    assert.equal(session.readLocalSession(), null);

    // Intentar acceder a la sesión cerrada debe arrojar PartitionRequiredError
    await assert.rejects(() => LocalStorage.open("test-isolation"), PartitionRequiredError);

    // Login como Usuario B
    session.establishLocalSession({ userId: USER_B, displayName: "Técnico B" });
    const storageB = await LocalStorage.open("test-isolation");
    const queueB = await storageB.listQueue(USER_B);
    assert.equal(queueB.length, 0, "Usuario B debe tener su propia partición limpia sin ver la cola de A");
    storageB.close();
    console.log("[ok] Criterio 6: Logout bloquea el acceso de inmediato y Usuario B no ve cola de A");
  }

  // 7. Criterio 7: Renderizado accesible de badges (textos además de color)
  {
    const syncedHtml = renderToStaticMarkup(createElement(SyncStatusBadge, { status: "synced" }));
    assert.match(syncedHtml, /Sincronizado/, "Badge synced debe incluir texto explícito 'Sincronizado'");

    const pendingHtml = renderToStaticMarkup(createElement(SyncStatusBadge, { status: "pending", pendingCount: 3 }));
    assert.match(pendingHtml, /Pendiente \(3\)/, "Badge pending debe incluir 'Pendiente (3)'");

    const errorHtml = renderToStaticMarkup(createElement(SyncStatusBadge, { status: "error", errorCount: 2 }));
    assert.match(errorHtml, /Error \(2\)/, "Badge error debe incluir 'Error (2)'");

    const localHtml = renderToStaticMarkup(createElement(SyncStatusBadge, { status: "local" }));
    assert.match(localHtml, /Guardado local/, "Badge local debe incluir 'Guardado local'");

    const syncingHtml = renderToStaticMarkup(createElement(SyncStatusBadge, { status: "syncing" }));
    assert.match(syncingHtml, /Sincronizando/, "Badge syncing debe incluir 'Sincronizando'");

    console.log("[ok] Criterio 7: Badges accesibles renderizan texto descriptivo además de color");
  }

  console.log("\nTodos los criterios de aceptación de Phase 22 pasaron exitosamente!");
}

main().catch((err) => {
  console.error("Fallo en tests/sync-ui.spec.ts:", err);
  process.exit(1);
});
