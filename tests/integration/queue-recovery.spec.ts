// tests/integration/queue-recovery.spec.ts
// Integration wrapper executing the canonical queue recovery integration suite (Issue #80).
// Propagates stdout, stderr, and exit codes cleanly to the academic test runner.
"use strict";

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const targetSuite = resolve(__dirname, "../queue-recovery.spec.ts");

// Execute the canonical queue recovery suite with --experimental-strip-types
// to ensure TypeScript types in imported domain contracts are cleanly handled under Node 22.x.
const run = spawnSync(process.execPath, ["--experimental-strip-types", targetSuite], {
  cwd: resolve(__dirname, "../.."),
  stdio: "inherit",
  env: process.env,
});

if (run.error) {
  console.error(run.error);
  process.exit(1);
}

process.exit(run.status ?? 1);
