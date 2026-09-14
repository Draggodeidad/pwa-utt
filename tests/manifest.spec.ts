const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const manifestPath = "public/manifest.webmanifest";

const readFile = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const exists = (relativePath) => existsSync(resolve(root, relativePath));
const existsInPublic = (iconSrc) => existsSync(resolve(root, "public", iconSrc.replace(/^\/+/, "")));

assert.ok(exists(manifestPath), `No existe ${manifestPath}`);

const manifest = JSON.parse(readFile(manifestPath));

assert.equal(typeof manifest.name, "string");
assert.ok(manifest.name.trim().length > 0, "manifest.name debe ser un texto no vacío");

assert.equal(typeof manifest.short_name, "string");
assert.ok(manifest.short_name.trim().length > 0, "manifest.short_name debe ser un texto no vacío");

assert.equal(typeof manifest.start_url, "string");
assert.ok(manifest.start_url.trim().length > 0, "manifest.start_url debe existir");
assert.ok(/^(\/|https?:\/\/)/.test(manifest.start_url), "manifest.start_url debe ser una ruta relativa o una URL absoluta");

assert.equal(typeof manifest.display, "string");
assert.ok(
  ["fullscreen", "standalone", "minimal-ui", "browser"].includes(manifest.display),
  "manifest.display debe ser un valor válido para una PWA"
);

assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i, "manifest.theme_color debe ser hexadecimal de 6 dígitos");
assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i, "manifest.background_color debe ser hexadecimal de 6 dígitos");

assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "manifest.icons debe existir y contener al menos un elemento");

for (const [index, icon] of manifest.icons.entries()) {
  assert.ok(icon && typeof icon === "object", `manifest.icons[${index}] debe ser un objeto`);

  assert.equal(typeof icon.src, "string", `manifest.icons[${index}].src debe ser una cadena`);
  assert.ok(icon.src.trim().length > 0, `manifest.icons[${index}].src no puede estar vacío`);

  assert.equal(typeof icon.sizes, "string", `manifest.icons[${index}].sizes debe ser una cadena`);
  assert.ok(icon.sizes.trim().length > 0, `manifest.icons[${index}].sizes no puede estar vacío`);

  assert.equal(typeof icon.type, "string", `manifest.icons[${index}].type debe ser una cadena`);
  assert.ok(icon.type.trim().length > 0, `manifest.icons[${index}].type no puede estar vacío`);
  assert.match(icon.type, /^image\//, `manifest.icons[${index}].type debe ser un MIME tipo image/*`);

  if (icon.src.startsWith("/")) {
    assert.ok(existsInPublic(icon.src), `No existe el icono referenciado en manifest.icons[${index}] (${icon.src})`);
  }
}

console.log("manifest.spec.ts: PASS");
