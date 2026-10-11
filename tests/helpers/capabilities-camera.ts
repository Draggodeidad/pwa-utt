// tests/helpers/capabilities-camera.ts
// Suite de pruebas de capacidades de cámara, validación de fotos, persistencia offline y recuperación remota.
// Cumple el contrato W06 de la Issue #72 para ejecución determinista sin hardware ni red real.
"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const sharp = require("sharp");
const { createCameraClient } = require("../../src/lib/device/camera.ts");
const { validatePhotoFile, photoSourceHash, PhotoValidationError } = require("../../src/lib/photos/validation.ts");
const { normalizePhoto } = require("../../src/lib/photos/server-validation.ts");
const { PHOTO_LIMITS } = require("../../src/features/findings/photo-contracts.ts");
const { createIndexedDbHarness } = require("./indexed-db-harness.ts");
const { LocalStorage } = require("../../src/lib/pwa/offline-storage.ts");
const { saveDraft } = require("../../src/features/inspections/services/local-capture.ts");
const { createLocalPhoto } = require("../../src/features/findings/services/photo.repository.ts");
const { uploadFindingPhoto } = require("../../src/lib/photos/remote.ts");

const owner = "11111111-1111-4111-8111-111111111172";
const otherOwner = "22222222-2222-4222-8222-222222222272";
const inspId = "33333333-3333-4333-8333-333333333372";
const findingId = "44444444-4444-4444-8444-444444444472";
const timestamp = "2026-10-10T12:00:00.000Z";

function makeCapture() {
  const meta = {
    ownerUserId: owner, localRevision: 1, baseVersion: null,
    syncStatus: "local", localUpdatedAt: timestamp, version: 0,
    createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
  };
  return {
    owner,
    inspection: {
      ...meta, id: inspId, folioNumber: 0, laboratoryId: null,
      inspectorId: owner, inspectionDate: "2026-10-10",
      summary: "Inspección sintética W06", workflowStatus: "draft",
      completedAt: null, updatedBy: owner,
    },
    findings: [{
      ...meta, id: findingId, inspectionId: inspId,
      title: "Hallazgo con fotos sintéticas", description: "Verificación de cámara y persistencia",
      priority: "high", status: "pending", resolvedAt: null,
      createdBy: owner, updatedBy: owner,
    }],
    removedFindings: [],
  };
}

async function makePhoto(id = crypto.randomUUID()) {
  return createLocalPhoto({
    id, owner, inspectionId: inspId, findingId,
    file: new Blob(["synthetic test image bytes"], { type: "image/jpeg" }),
  });
}

/**
 * Función requerida por el contrato W06 de tests/capabilities.spec.ts.
 * Ejecuta aserciones reales y retorna el número total de escenarios superados.
 */
async function runCameraCapabilitiesSuite() {
  let passedScenarios = 0;

  // =========================================================================
  // BLOQUE 1: Contrato del cliente de cámara (src/lib/device/camera.ts)
  // =========================================================================

  let getUserMediaCalls = 0;
  let tracksStopped = 0;
  const mockTrack = { stop: () => { tracksStopped++; } };
  const mockStream = { getTracks: () => [mockTrack] };

  const defaultDependencies = {
    isSecureContext: () => true,
    mediaDevices: {
      getUserMedia: async (options) => {
        getUserMediaCalls++;
        assert.equal(options.audio, false, "La solicitud de medios no debe pedir audio");
        assert.deepEqual(options.video, { facingMode: { ideal: "environment" } }, "Debe solicitar cámara trasera/entorno");
        return mockStream;
      },
    },
    captureFrame: async () => new Blob(["synthetic jpeg content"], { type: "image/jpeg" }),
    objectUrls: {
      createObjectURL: () => "blob:synthetic-url",
      revokeObjectURL: () => {},
    },
    now: () => 1000,
  };

  // 1. Instanciación no solicita permisos ni abre stream
  {
    const camera = createCameraClient(defaultDependencies);
    assert.equal(getUserMediaCalls, 0, "createCameraClient no debe solicitar getUserMedia en la construcción");
    passedScenarios++;
  }

  // 2. Apertura explícita abre el stream de medios
  {
    const camera = createCameraClient(defaultDependencies);
    const opened = await camera.open();
    assert.equal(opened.status, "success", "open() explícito debe tener éxito");
    assert.equal(getUserMediaCalls, 1, "open() debe invocar getUserMedia exactamente una vez");
    passedScenarios++;
  }

  // 3. Captura exitosa devuelve Blob con contenido
  {
    const camera = createCameraClient(defaultDependencies);
    const opened = await camera.open();
    assert.equal(opened.status, "success");
    const captureResult = await opened.value.capture();
    assert.equal(captureResult.status, "success", "capture() debe devolver success");
    assert.ok(captureResult.value instanceof Blob, "El resultado debe ser una instancia de Blob");
    assert.ok(captureResult.value.size > 0, "El blob no debe estar vacío");
    passedScenarios++;
  }

  // 4. Detención explícita libera los tracks
  {
    tracksStopped = 0;
    const camera = createCameraClient(defaultDependencies);
    const opened = await camera.open();
    assert.equal(opened.status, "success");
    opened.value.stop();
    assert.equal(tracksStopped, 1, "stop() debe detener los tracks de video");
    passedScenarios++;
  }

  // 5. Idempotencia de stop()
  {
    tracksStopped = 0;
    const camera = createCameraClient(defaultDependencies);
    const opened = await camera.open();
    assert.equal(opened.status, "success");
    opened.value.stop();
    opened.value.stop();
    assert.equal(tracksStopped, 1, "Múltiples llamadas a stop() no deben duplicar detenciones");
    passedScenarios++;
  }

  // 6. Captura tras stop() devuelve cancelado
  {
    const camera = createCameraClient(defaultDependencies);
    const opened = await camera.open();
    assert.equal(opened.status, "success");
    opened.value.stop();
    const cancelledCapture = await opened.value.capture();
    assert.equal(cancelledCapture.status, "cancelled", "Capturar tras detener debe retornar cancelled");
    assert.equal(cancelledCapture.fallback, "file-picker");
    passedScenarios++;
  }

  // 7. Permiso denegado (NotAllowedError)
  {
    const notAllowedError = Object.assign(new Error("Permiso denegado por el usuario"), { name: "NotAllowedError" });
    const camera = createCameraClient({
      ...defaultDependencies,
      mediaDevices: { getUserMedia: async () => { throw notAllowedError; } },
    });
    const denied = await camera.open();
    assert.equal(denied.status, "denied", "NotAllowedError debe mapear a status denied");
    assert.equal(denied.code, "permission-denied");
    assert.equal(denied.fallback, "file-picker");
    passedScenarios++;
  }

  // 8. Permiso denegado por seguridad (SecurityError)
  {
    const securityError = Object.assign(new Error("Error de seguridad"), { name: "SecurityError" });
    const camera = createCameraClient({
      ...defaultDependencies,
      mediaDevices: { getUserMedia: async () => { throw securityError; } },
    });
    const denied = await camera.open();
    assert.equal(denied.status, "denied");
    assert.equal(denied.code, "permission-denied");
    passedScenarios++;
  }

  // 9. API de mediaDevices no disponible
  {
    const camera = createCameraClient({
      ...defaultDependencies,
      mediaDevices: null,
    });
    const unsupported = await camera.open();
    assert.equal(unsupported.status, "unsupported", "Sin mediaDevices debe retornar unsupported");
    assert.equal(unsupported.code, "api-unavailable");
    assert.equal(unsupported.fallback, "file-picker");
    passedScenarios++;
  }

  // 10. Contexto inseguro (HTTP en lugar de HTTPS / localhost)
  {
    const camera = createCameraClient({
      ...defaultDependencies,
      isSecureContext: () => false,
    });
    const insecure = await camera.open();
    assert.equal(insecure.status, "unsupported", "Contexto inseguro debe retornar unsupported");
    assert.equal(insecure.code, "insecure-context");
    assert.equal(insecure.fallback, "file-picker");
    passedScenarios++;
  }

  // 11. Dispositivo no encontrado (NotFoundError)
  {
    const notFoundError = Object.assign(new Error("Cámara no encontrada"), { name: "NotFoundError" });
    const camera = createCameraClient({
      ...defaultDependencies,
      mediaDevices: { getUserMedia: async () => { throw notFoundError; } },
    });
    const noDevice = await camera.open();
    assert.equal(noDevice.status, "error");
    assert.equal(noDevice.code, "no-device");
    assert.equal(noDevice.fallback, "file-picker");
    passedScenarios++;
  }

  // 12. Fallo en captura libera tracks y devuelve error
  {
    tracksStopped = 0;
    const camera = createCameraClient({
      ...defaultDependencies,
      captureFrame: async () => { throw new Error("Fallo de codificación de canvas"); },
    });
    const opened = await camera.open();
    assert.equal(opened.status, "success");
    const failedCapture = await opened.value.capture();
    assert.equal(failedCapture.status, "error", "Fallo al codificar frame debe devolver status error");
    assert.equal(failedCapture.code, "capture-failed");
    assert.equal(tracksStopped, 1, "Fallo en captura debe invocar stop() automáticamente");
    passedScenarios++;
  }

  // 13. Fotograma con 0 bytes detectado como error
  {
    tracksStopped = 0;
    const camera = createCameraClient({
      ...defaultDependencies,
      captureFrame: async () => new Blob([], { type: "image/jpeg" }),
    });
    const opened = await camera.open();
    assert.equal(opened.status, "success");
    const emptyCapture = await opened.value.capture();
    assert.equal(emptyCapture.status, "error");
    assert.equal(emptyCapture.code, "capture-failed");
    assert.equal(tracksStopped, 1);
    passedScenarios++;
  }

  // =========================================================================
  // BLOQUE 2: Validación de archivos y sanitización (src/lib/photos/validation.ts)
  // =========================================================================

  // 14. Archivo vacío es rechazado
  {
    assert.throws(
      () => validatePhotoFile(new Blob([], { type: "image/jpeg" })),
      (err) => err instanceof PhotoValidationError && err.code === "empty-file",
      "Blob de 0 bytes debe arrojar empty-file"
    );
    passedScenarios++;
  }

  // 15. Formato no admitido (SVG, PDF, GIF) es rechazado
  {
    assert.throws(
      () => validatePhotoFile(new Blob(["fake data"], { type: "image/svg+xml" })),
      (err) => err instanceof PhotoValidationError && err.code === "invalid-format",
      "MIME no permitido debe arrojar invalid-format"
    );
    passedScenarios++;
  }

  // 16. Archivo válido dentro del límite permitido
  {
    const validBlob = new Blob([new Uint8Array(1024)], { type: "image/jpeg" });
    const mime = validatePhotoFile(validBlob);
    assert.equal(mime, "image/jpeg");
    passedScenarios++;
  }

  // 17. Límite exacto de 5 MB es admitido
  {
    const exactBlob = new Blob([new Uint8Array(PHOTO_LIMITS.maxBytes)], { type: "image/png" });
    const mime = validatePhotoFile(exactBlob);
    assert.equal(mime, "image/png", "Exactamente 5 MB debe ser admitido");
    passedScenarios++;
  }

  // 18. Exceso de límite de tamaño (5 MB + 1 byte) es rechazado
  {
    const overflowBlob = new Blob([new Uint8Array(PHOTO_LIMITS.maxBytes + 1)], { type: "image/webp" });
    assert.throws(
      () => validatePhotoFile(overflowBlob),
      (err) => err instanceof PhotoValidationError && err.code === "too-large",
      "5 MB + 1 byte debe arrojar too-large"
    );
    passedScenarios++;
  }

  // 19. Cálculo determinista de hash SHA-256
  {
    const testContent = "antigravity synthetic test content for hash";
    const testBlob = new Blob([testContent], { type: "image/jpeg" });
    const hash = await photoSourceHash(testBlob);
    const expectedHash = createHash("sha256").update(testContent).digest("hex");
    assert.equal(hash, expectedHash, "photoSourceHash debe coincidir con el hash SHA-256 nativo");
    assert.equal(hash.length, 64);
    passedScenarios++;
  }

  // 20. Normalización y sanitización con sharp (eliminación de EXIF)
  {
    const testBuffer = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#00ff00" },
    }).jpeg().toBuffer();

    const normalized = await normalizePhoto(testBuffer, "image/jpeg");
    assert.equal(normalized.mimeType, "image/jpeg");
    assert.equal(normalized.hash.length, 64);
    const meta = await sharp(normalized.bytes).metadata();
    assert.equal(meta.exif, undefined, "La imagen normalizada no debe contener metadatos EXIF");
    passedScenarios++;
  }

  // =========================================================================
  // BLOQUE 3: Persistencia local IndexedDB y aislamiento (src/lib/pwa/offline-storage.ts)
  // =========================================================================

  const harness = createIndexedDbHarness();
  const previousIndexedDB = globalThis.indexedDB;
  globalThis.indexedDB = harness.indexedDB;

  try {
    // 21. Persistencia offline de foto asociada y recuperación tras recarga
    {
      let storage = await LocalStorage.open("test-capabilities-offline");
      const img = await makePhoto();
      await saveDraft(owner, storage, {
        ...makeCapture(),
        photos: { add: [img], remove: [] },
      });

      storage.close();
      storage = await LocalStorage.open("test-capabilities-offline");

      const retrieved = await storage.getPhoto(owner, img.id);
      assert.ok(retrieved, "La foto debe existir en el almacenamiento local tras reapertura");
      assert.equal(retrieved.id, img.id);
      assert.equal(retrieved.findingId, findingId);
      assert.equal(retrieved.inspectionId, inspId);
      assert.ok(retrieved.blob, "El blob de la foto debe preservarse");
      assert.equal(retrieved.blob.size, img.blob.size);
      storage.close();
      passedScenarios++;
    }

    // 22. Aislamiento multiusuario: otra cuenta no puede leer la foto
    {
      const storage = await LocalStorage.open("test-capabilities-isolation");
      const img = await makePhoto();
      await saveDraft(owner, storage, {
        ...makeCapture(),
        photos: { add: [img], remove: [] },
      });

      const foreignPhoto = await storage.getPhoto(otherOwner, img.id);
      assert.equal(foreignPhoto, null, "Una cuenta ajena no debe tener acceso a fotos de otra cuenta");

      const foreignQueue = await storage.listQueue(otherOwner);
      assert.equal(foreignQueue.length, 0, "La cola de la cuenta ajena debe estar vacía");
      storage.close();
      passedScenarios++;
    }

    // 23. Rollback atómico ante fallo de cuota en photo_local
    {
      const storage = await LocalStorage.open("test-capabilities-quota");
      harness.failNextPut("photo_local", new Error("synthetic quota exceeded"));
      const img = await makePhoto();

      await assert.rejects(
        saveDraft(owner, storage, {
          ...makeCapture(),
          photos: { add: [img], remove: [] },
        }),
        "Debe rechazar la transacción completa ante fallo de cuota"
      );

      const photos = await storage.listPhotos(owner);
      assert.equal(photos.length, 0, "No deben quedar fotos huérfanas tras fallo de cuota");
      storage.close();
      passedScenarios++;
    }

    // 24. Límite de 3 fotos por hallazgo es respetado
    {
      const storage = await LocalStorage.open("test-capabilities-limits");
      const p1 = await makePhoto();
      const p2 = await makePhoto();
      const p3 = await makePhoto();

      await saveDraft(owner, storage, {
        ...makeCapture(),
        photos: { add: [p1, p2, p3], remove: [] },
      });
      assert.equal((await storage.listPhotos(owner)).length, 3);

      const p4 = await makePhoto();
      await assert.rejects(
        saveDraft(owner, storage, {
          ...makeCapture(),
          photos: { add: [p4], remove: [] },
        }),
        /too-many/,
        "Exceder 3 fotos por hallazgo debe arrojar too-many"
      );
      storage.close();
      passedScenarios++;
    }

    // =========================================================================
    // BLOQUE 4: Sincronización remota, idempotencia y recuperación (src/lib/photos/remote.ts)
    // =========================================================================

    // 25. Recuperación ante fallo de metadatos RPC e idempotencia
    {
      const sourceImage = await sharp({
        create: { width: 2, height: 2, channels: 3, background: "blue" },
      }).png().toBuffer();

      const photoPayload = {
        findingId,
        inspectionId: inspId,
        mimeType: "image/png",
        bytes: sourceImage.length,
        sourceHash: createHash("sha256").update(sourceImage).digest("hex"),
      };

      const storageObjects = new Map();
      let photoRow = null;
      let failRpcMetadata = true;
      let uploadCount = 0;

      const mockSupabase = {
        from: (table) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: table === "findings" ? { inspection_id: inspId } : photoRow,
                error: null,
              }),
            }),
          }),
        }),
        rpc: async (name, args) => {
          if (name === "reserve_finding_photo") {
            if (!photoRow) {
              photoRow = {
                id: "photo-rpc-1", finding_id: findingId, inspection_id: inspId,
                owner_user_id: owner, mime_type: args.p_mime, bytes: args.p_bytes,
                source_hash: args.p_source_hash, content_hash: args.p_content_hash,
                bucket: "finding-photos", object_path: "photo-rpc-1", state: "pending",
                version: 1, created_at: timestamp, updated_at: timestamp,
              };
            }
            return { data: { ...photoRow, __replayed: photoRow.state === "uploaded" }, error: null };
          }
          if (name === "complete_finding_photo") {
            if (failRpcMetadata) {
              failRpcMetadata = false;
              return { error: { message: "synthetic RPC metadata failure" } };
            }
            photoRow.state = "uploaded";
            photoRow.version = 2;
            return { data: photoRow, error: null };
          }
          throw new Error(`RPC inesperada: ${name}`);
        },
        storage: {
          from: () => ({
            upload: async (path, bytes, options) => {
              uploadCount++;
              assert.equal(options.upsert, false, "La subida no debe usar upsert ciego");
              if (storageObjects.has(path)) return { error: { message: "exists" } };
              storageObjects.set(path, bytes);
              return { error: null };
            },
            download: async (path) => ({
              data: storageObjects.has(path) ? new Blob([storageObjects.get(path)]) : null,
              error: storageObjects.has(path) ? null : { message: "missing" },
            }),
            remove: async (paths) => {
              paths.forEach((p) => storageObjects.delete(p));
              return { error: null };
            },
          }),
        },
      };

      // Primer intento: sube a Storage pero RPC de metadatos falla
      await assert.rejects(
        uploadFindingPhoto(mockSupabase, "photo-rpc-1", "op-1", photoPayload, sourceImage),
        /synthetic RPC metadata failure/
      );
      assert.equal(storageObjects.size, 1, "El objeto debe permanecer en Storage");
      assert.equal(photoRow.state, "pending", "La fila debe permanecer en pending");

      // Reintento: detecta objeto ya subido, completa metadatos y no duplica la subida
      const retried = await uploadFindingPhoto(mockSupabase, "photo-rpc-1", "op-1", photoPayload, sourceImage);
      assert.equal(retried.photo.status, "uploaded");
      assert.equal(uploadCount, 2, "Segundo intento consulta el objeto sin subir nuevo archivo");

      // Tercer intento: idempotente (replayed: true)
      const replay = await uploadFindingPhoto(mockSupabase, "photo-rpc-1", "op-1", photoPayload, sourceImage);
      assert.equal(replay.replayed, true, "Reintento de operación confirmada debe marcar replayed: true");
      passedScenarios++;
    }
  } finally {
    globalThis.indexedDB = previousIndexedDB;
  }

  return passedScenarios;
}

// Exportación compatible con require() y con el runner tests/capabilities.spec.ts
module.exports = { runCameraCapabilitiesSuite };
exports.runCameraCapabilitiesSuite = runCameraCapabilitiesSuite;

// Ejecución autónoma si se invoca directamente desde terminal
if (require.main === module) {
  runCameraCapabilitiesSuite()
    .then((count) => {
      console.log(`capabilities-camera.ts: PASS (${count} scenarios)`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
