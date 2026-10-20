const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

// Execute the real Next HTTP workflow assertions against its synthetic backend.
const suite = resolve(__dirname, "../online-inspection-workflow.spec.ts");
const run = spawnSync(process.execPath, [suite], { stdio: "inherit" });

if (run.error) {
  console.error(run.error);
  process.exitCode = 1;
} else {
  process.exitCode = run.status ?? 1;
}
