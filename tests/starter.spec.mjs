import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const page = await readFile(resolve(root, "src/app/page.tsx"), "utf8");
const login = await readFile(resolve(root, "src/features/auth/components/LoginScreen.tsx"), "utf8");

assert.equal(packageJson.scripts.build, "next build");
assert.match(page, /LoginScreen/);
assert.match(login, /Acceso no concedido/);
assert.match(login, /"idle" \| "loading" \| "error"/);
assert.match(login, /Modo sin conexión disponible una vez autenticado/);
assert.match(login, /lucide-react/);
assert.doesNotMatch(login, /\/figma\/login/);
console.log("starter.spec.mjs: PASS");
