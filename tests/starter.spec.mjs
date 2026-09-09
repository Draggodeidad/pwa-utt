import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const page = await readFile(resolve(root, "src/app/page.tsx"), "utf8");
const home = await readFile(resolve(root, "src/features/inspections/components/TechnicianHomeWorkspace.tsx"), "utf8");

assert.equal(packageJson.scripts.build, "next build");
assert.match(page, /TechnicianHomeWorkspace/);
assert.match(home, /Buen día/);
assert.match(home, /Nueva inspección/);
assert.match(home, /Próximo punto asignado/);
assert.match(home, /lucide-react/);
assert.doesNotMatch(home, /\/figma\/login/);
console.log("starter.spec.mjs: PASS");
