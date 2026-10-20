import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const levels = {
  unit: { directory: "tests/unit", label: "unitario" },
  integration: { directory: "tests/integration", label: "integración" },
};
const levelName = process.argv[2];
const level = levels[levelName];

if (!level) {
  console.error("Uso: node scripts/run-test-level.mjs <unit|integration>");
  process.exitCode = 2;
} else {
  const directory = resolve(root, level.directory);
  let specs = [];

  try {
    specs = readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".spec.ts"))
      .map(entry => entry.name)
      .sort();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (specs.length === 0) {
    console.error(`Nivel ${level.label} vacío: agrega al menos un archivo ${level.directory}/*.spec.ts.`);
    process.exitCode = 1;
  } else {
    console.log(`Nivel ${level.label}: ${specs.length} suite(s) registrada(s).`);
    const failures = [];

    for (const spec of specs) {
      const path = resolve(directory, spec);
      console.log(`\nEjecutando ${level.directory}/${spec}`);
      const run = spawnSync(process.execPath, [path], { cwd: root, stdio: "inherit" });
      const exitCode = run.error ? 1 : run.status ?? 1;
      if (run.error) console.error(run.error);
      if (exitCode !== 0) failures.push({ spec, exitCode, signal: run.signal });
    }

    if (failures.length) {
      for (const failure of failures) {
        const signal = failure.signal ? ` (señal ${failure.signal})` : "";
        console.error(`${failure.spec}: exitCode ${failure.exitCode}${signal}`);
      }
      process.exitCode = failures[0].exitCode;
    }
  }
}
