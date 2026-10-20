const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

// Run the existing domain assertions unchanged; this entry point only classifies them.
const suite = resolve(__dirname, "../domain-contracts.spec.ts");
const run = spawnSync(process.execPath, [suite], { stdio: "inherit" });

if (run.error) {
  console.error(run.error);
  process.exitCode = 1;
} else {
  process.exitCode = run.status ?? 1;
}
