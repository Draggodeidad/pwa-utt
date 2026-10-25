// tests/unit/photo-validation.spec.ts
// Suite de pruebas unitarias puras para validación y hash de fotografías (Issue #79).
// No depende de cámara, Sharp, red, base de datos ni servidores.
"use strict";

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

// Si se ejecuta directamente sin --experimental-strip-types, autoinvoca el runner con la bandera requerida por TypeScript.
if (!process.execArgv.includes("--experimental-strip-types")) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", __filename], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const assert = require("node:assert/strict");
const { validatePhotoFile, photoSourceHash, PhotoValidationError } = require("../../src/lib/photos/validation.ts");
const { PHOTO_LIMITS } = require("../../src/features/findings/photo-contracts.ts");

async function runPhotoUnitSuite() {
  console.log("Iniciando suite unitaria pura de fotos (Issue #79)...");
  let passed = 0;

  // -------------------------------------------------------------------------
  // 1. Archivo vacío (0 bytes) lanza PhotoValidationError("empty-file")
  // -------------------------------------------------------------------------
  {
    const emptyBlob = new Blob([], { type: "image/jpeg" });
    assert.throws(
      () => validatePhotoFile(emptyBlob),
      (err) => err instanceof PhotoValidationError && err.code === "empty-file",
      "Debe lanzar PhotoValidationError con código 'empty-file' ante 0 bytes"
    );
    passed++;
  }

  // -------------------------------------------------------------------------
  // 2. Formatos MIME válidos permitidos (jpeg, png, webp) son aceptados
  // -------------------------------------------------------------------------
  for (const mimeType of PHOTO_LIMITS.mimeTypes) {
    const validBlob = new Blob(["synthetic test bytes"], { type: mimeType });
    const returnedMime = validatePhotoFile(validBlob);
    assert.strictEqual(
      returnedMime,
      mimeType,
      `Debe aceptar formato válido '${mimeType}' y retornar su tipo exacto`
    );
    passed++;
  }

  // -------------------------------------------------------------------------
  // 3. Límite exacto de 5 MiB (5,242,880 bytes) es aceptado exitosamente
  // -------------------------------------------------------------------------
  {
    const exactLimitBytes = new Uint8Array(PHOTO_LIMITS.maxBytes);
    const exactLimitBlob = new Blob([exactLimitBytes], { type: "image/jpeg" });
    assert.strictEqual(exactLimitBlob.size, 5 * 1024 * 1024);
    const returnedMime = validatePhotoFile(exactLimitBlob);
    assert.strictEqual(returnedMime, "image/jpeg", "Debe aceptar un archivo en el límite exacto de 5 MiB");
    passed++;
  }

  // -------------------------------------------------------------------------
  // 4. Exceso de límite por 1 byte (5 MiB + 1 byte) lanza PhotoValidationError("too-large")
  // -------------------------------------------------------------------------
  {
    const overflowBytes = new Uint8Array(PHOTO_LIMITS.maxBytes + 1);
    const overflowBlob = new Blob([overflowBytes], { type: "image/png" });
    assert.strictEqual(overflowBlob.size, 5 * 1024 * 1024 + 1);
    assert.throws(
      () => validatePhotoFile(overflowBlob),
      (err) => err instanceof PhotoValidationError && err.code === "too-large",
      "Debe lanzar PhotoValidationError con código 'too-large' al exceder 5 MiB por 1 byte"
    );
    passed++;
  }

  // -------------------------------------------------------------------------
  // 5. Formatos no permitidos lanzan PhotoValidationError("invalid-format")
  // -------------------------------------------------------------------------
  const invalidMimes = [
    "application/pdf",
    "image/svg+xml",
    "image/gif",
    "text/plain",
    "application/octet-stream",
    "",
  ];
  for (const invalidMime of invalidMimes) {
    const invalidBlob = new Blob(["synthetic invalid content"], { type: invalidMime });
    assert.throws(
      () => validatePhotoFile(invalidBlob),
      (err) => err instanceof PhotoValidationError && err.code === "invalid-format",
      `Debe lanzar PhotoValidationError con código 'invalid-format' ante tipo '${invalidMime}'`
    );
    passed++;
  }

  // -------------------------------------------------------------------------
  // 6. Determinismo del hash SHA-256 (mismos bytes producen idéntico hash hex de 64 chars)
  // -------------------------------------------------------------------------
  {
    const content = "synthetic photo content for deterministic hash verification 12345";
    const blob1 = new Blob([content], { type: "image/jpeg" });
    const blob2 = new Blob([content], { type: "image/jpeg" });

    const hash1 = await photoSourceHash(blob1);
    const hash2 = await photoSourceHash(blob2);

    assert.strictEqual(typeof hash1, "string");
    assert.strictEqual(hash1.length, 64, "El hash SHA-256 debe tener longitud de 64 caracteres");
    assert.match(hash1, /^[0-9a-f]{64}$/, "El hash debe ser una cadena hexadecimal en minúsculas");
    assert.strictEqual(hash1, hash2, "Mismos bytes deben producir exactamente el mismo hash");
    passed++;
  }

  // -------------------------------------------------------------------------
  // 7. Contenidos sintéticos diferentes producen hashes distintos
  // -------------------------------------------------------------------------
  {
    const blobA = new Blob(["synthetic content A"], { type: "image/png" });
    const blobB = new Blob(["synthetic content B"], { type: "image/png" });

    const hashA = await photoSourceHash(blobA);
    const hashB = await photoSourceHash(blobB);

    assert.notStrictEqual(hashA, hashB, "Contenidos binarios diferentes deben producir hashes distintos");
    passed++;
  }

  console.log(`tests/unit/photo-validation.spec.ts: PASS (${passed} casos probados)`);
}

runPhotoUnitSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
