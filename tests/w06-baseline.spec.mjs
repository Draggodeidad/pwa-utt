import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Baseline infrastructure tests only; never substitute for device behavior tests.
const root = mkdtempSync(join(tmpdir(), "pwa-w06-gate-"));
const source = resolve(import.meta.dirname, "..");
const camera = "runCameraCapabilitiesSuite";
const geo = "runGeolocationNotificationsSuite";
function write(file, content) {
  const path = join(root, file);
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content);
}
function runRunner() {
  return spawnSync(process.execPath, ["tests/capabilities.spec.ts"], { cwd: root, encoding: "utf8" });
}
function expectFailure(marker) {
  const result = runRunner();
  assert.equal(result.status, 1, result.stderr);
  assert.ok(result.stderr.includes(marker), result.stderr);
}
function runCheck() {
  return spawnSync("bash", ["public-tests/check-w06.sh"], { cwd: root, encoding: "utf8" });
}
try {
  write("tests/capabilities.spec.ts", "");
  copyFileSync(join(source, "tests/capabilities.spec.ts"), join(root, "tests/capabilities.spec.ts"));
  expectFailure("W06_SUITE_MISSING");
  write("tests/helpers/capabilities-camera.ts", "  ");
  expectFailure("W06_SUITE_EMPTY");
  write("tests/helpers/capabilities-camera.ts", "module.exports = {};");
  expectFailure("W06_SUITE_EXPORT_INVALID");
  write("tests/helpers/capabilities-camera.ts", `exports.${camera} = async () => 0;`);
  write("tests/helpers/capabilities-geolocation-notifications.ts", `exports.${geo} = async () => 1;`);
  expectFailure("W06_SUITE_NO_SCENARIOS");
  write("tests/helpers/capabilities-camera.ts", `exports.${camera} = async () => { require('node:assert/strict').equal(1, 2); return 1; };`);
  expectFailure("AssertionError");
  write("tests/helpers/capabilities-camera.ts", `exports.${camera} = async () => 1;`);
  const positive = runRunner();
  assert.equal(positive.status, 0, positive.stderr);
  assert.ok(positive.stdout.includes("capabilities.spec.ts: PASS"));
  // Also validate rejection of the SECOND missing/empty/broken suite.
  rmSync(join(root, "tests/helpers/capabilities-geolocation-notifications.ts"));
  expectFailure("W06_SUITE_MISSING");
  write("tests/helpers/capabilities-geolocation-notifications.ts", " ");
  expectFailure("W06_SUITE_EMPTY");
  write("tests/helpers/capabilities-geolocation-notifications.ts", "module.exports = {};");
  expectFailure("W06_SUITE_EXPORT_INVALID");
  write("tests/helpers/capabilities-geolocation-notifications.ts", `exports.${geo} = async () => 0;`);
  expectFailure("W06_SUITE_NO_SCENARIOS");
  write("tests/helpers/capabilities-geolocation-notifications.ts", `exports.${geo} = async () => { require('node:assert/strict').fail('regression'); };`);
  expectFailure("AssertionError");

  write("public-tests/check-w06.sh", "");
  copyFileSync(join(source, "public-tests/check-w06.sh"), join(root, "public-tests/check-w06.sh"));
  assert.equal(runCheck().status, 1, "missing deliverables must fail");
  for (const file of ["src/lib/device/camera.ts", "src/lib/device/geolocation.ts", "src/lib/notifications/client.ts", "docs/capabilities.md", "README.md", "evidence/individual.md"]) write(file, "synthetic gate fixture");
  write("package.json", JSON.stringify({ scripts: { test: "node tests/capabilities.spec.ts" } }));
  assert.equal(runCheck().status, 0, "structure-only gate can pass with populated fixtures");
  write("docs/capabilities.md", " ");
  assert.equal(runCheck().status, 1, "whitespace artifact must fail");
  write("docs/capabilities.md", "synthetic gate fixture");
  write("package.json", JSON.stringify({ scripts: { test: "node tests/other.spec.ts" }, description: "node tests/capabilities.spec.ts" }));
  const unregistered = runCheck();
  assert.equal(unregistered.status, 1);
  assert.ok(unregistered.stderr.includes("W06_TEST_NOT_REGISTERED"));
  console.log("w06-baseline.spec.mjs: PASS (runner/gate only; device behavior pending)");
} finally {
  rmSync(root, { recursive: true, force: true });
}
