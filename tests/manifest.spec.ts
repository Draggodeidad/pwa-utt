const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const manifest = JSON.parse(read("public/manifest.webmanifest"));

assert.equal(manifest.name, "Inspecciones de Laboratorio");
assert.equal(manifest.short_name, "Inspecciones");
assert.equal(manifest.lang, "es-MX");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.scope, "/");
assert.equal(manifest.display, "standalone");
assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);

for (const size of ["192x192", "512x512"]) {
  const icon = manifest.icons.find((candidate) => candidate.sizes === size && candidate.type === "image/png");
  assert.ok(icon, `Falta el icono PNG ${size}`);
  assert.ok(existsSync(resolve(root, "public", icon.src.replace(/^\//, ""))), `No existe ${icon.src}`);
}

assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"), "Falta un icono maskable");
assert.ok(manifest.shortcuts.every((shortcut) => shortcut.url.startsWith(manifest.scope)), "Los accesos directos deben permanecer dentro del scope");

const layout = read("src/app/layout.tsx");
const shell = read("src/components/app-shell.tsx");
const home = read("src/features/inspections/components/TechnicianHomeWorkspace.tsx");

assert.match(layout, /manifest:\s*["']\/manifest\.webmanifest["']/);
assert.match(layout, /themeColor:\s*["']#1B3737["']/);
assert.match(shell, /<nav aria-label="Navegación principal"/);
assert.match(shell, /<main className=/);
assert.match(shell, /state: "loading"/);
assert.match(shell, /state: "empty"/);
assert.match(shell, /state: "error"/);
assert.match(shell, /aria-busy="true"/);
assert.match(home, /state === "loading"/);
assert.match(home, /state === "empty"/);
assert.match(home, /state === "error"/);

console.log("manifest.spec.ts: PASS");
