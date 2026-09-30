// Offline shell spec: exercises the local session memory and the build-time
// offline assets generator. The service worker readiness and essential-asset
// precache are covered by offline.spec.ts against the SW harness.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const { rememberLocalSession, clearLocalSession, readLocalSession } = require("../src/lib/pwa/offline-session.ts");

async function run() {
  assert.equal(readLocalSession(), null, "sin sesión recordada no hay acceso local");
  rememberLocalSession({ userId: "11111111-1111-4111-8111-111111111111", displayName: "Técnica de prueba" });
  assert.deepEqual(readLocalSession(), { userId: "11111111-1111-4111-8111-111111111111", displayName: "Técnica de prueba" });
  clearLocalSession();
  assert.equal(readLocalSession(), null, "el cierre de sesión borra el acceso local");

  store.set("pwa-utt:active-session", "{not-json");
  assert.equal(readLocalSession(), null, "una sesión local corrupta no revela datos");

  // El generador produce el manifest desde un árbol de build real.
  const buildDir = mkdtempSync(join(tmpdir(), "offline-assets-build-"));
  try {
    mkdirSync(join(buildDir, ".next", "static", "chunks"), { recursive: true });
    mkdirSync(join(buildDir, ".next", "static", "css"), { recursive: true });
    writeFileSync(join(buildDir, ".next", "static", "chunks", "app.js"), "// app");
    writeFileSync(join(buildDir, ".next", "static", "css", "app.css"), "/* app */");
    const output = join(buildDir, "offline-assets.json");
    const generated = spawnSync(process.execPath, ["scripts/generate-offline-assets.mjs", join(buildDir, ".next", "static"), output], {
      cwd: process.cwd(), encoding: "utf8",
    });
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(manifest.version, 1);
    assert.deepEqual(manifest.assets, ["/_next/static/chunks/app.js", "/_next/static/css/app.css"], "identifica JS/CSS del build");
  } finally {
    rmSync(buildDir, { recursive: true, force: true });
  }

  // Sin build previo el generador produce un manifest vacío sin fallar.
  const emptyDir = mkdtempSync(join(tmpdir(), "offline-assets-empty-"));
  try {
    const output = join(emptyDir, "offline-assets.json");
    const generated = spawnSync(process.execPath, ["scripts/generate-offline-assets.mjs", join(emptyDir, ".next", "static"), output], {
      cwd: process.cwd(), encoding: "utf8",
    });
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);
    assert.deepEqual(JSON.parse(readFileSync(output, "utf8")).assets, []);
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }

  console.log("offline-shell.spec.ts: PASS");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });