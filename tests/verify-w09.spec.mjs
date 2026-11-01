// Exercise the real reporter in a disposable clone with controlled child exits.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "w09-reporter-"));
const fixture = join(temp, "repo");
const sentinel = "w09_synthetic_redaction_sentinel";
try {
  const clone = spawnSync("git", ["clone", "--quiet", "--shared", root, fixture], { encoding: "utf8" });
  assert.equal(clone.status, 0);
  for (const dir of ["scripts", "tests", "public-tests"]) mkdirSync(join(fixture, dir), { recursive: true });
  writeFileSync(join(fixture, "scripts/verify-w09.mjs"), readFileSync(join(root, "scripts/verify-w09.mjs")));
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ scripts: { "test:security": "node tests/security.spec.ts" } }));
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture, encoding: "utf8" }).stdout.trim();
  const subprocesses = (gateExit, suiteExit) => {
    writeFileSync(join(fixture, "public-tests/check-w09.sh"), `echo '${sentinel}'\nexit ${gateExit}\n`);
    writeFileSync(join(fixture, "tests/security.spec.ts"), `console.error('${sentinel}'); process.exit(${suiteExit});\n`);
  };
  const run = (args = [], env = {}) => spawnSync(process.execPath, ["scripts/verify-w09.mjs", ...args], { cwd: fixture, encoding: "utf8", env: { ...process.env, ...env }, timeout: 20000 });
  const report = () => JSON.parse(readFileSync(join(fixture, "evaluation-result.json"), "utf8"));
  subprocesses(7, 9);
  let result = run();
  assert.equal(result.status, 1);
  let saved = report();
  assert.equal(saved.assignmentId, "w09-security-privacy"); assert.equal(saved.commitSha, sha);
  assert.equal(saved.workingTreeClean, false); assert.equal(saved.status, "fail");
  assert.deepEqual(saved.checks.map(c => c.exitCode), [7, 9]);
  for (const value of [JSON.stringify(saved), result.stdout, result.stderr]) assert.ok(!value.includes(sentinel));
  subprocesses(0, 0);
  result = run(); assert.equal(result.status, 0); assert.equal(report().status, "pass");
  // Owner correction for #104: exercise the real suite's outer rejection path.
  // Inject only an early synthetic throw in the disposable copy, never in production.
  const suite = readFileSync(join(root, "tests/security.spec.ts"), "utf8");
  const entry = "async function main() {";
  assert.equal(suite.split(entry).length, 2);
  writeFileSync(join(fixture, "tests/security.spec.ts"), suite.replace(entry, `${entry}\n  throw new Error(${JSON.stringify(sentinel)});`));
  const crashed = spawnSync(process.execPath, ["--experimental-strip-types", "tests/security.spec.ts"], { cwd: fixture, encoding: "utf8", timeout: 20000 });
  assert.equal(crashed.status, 1);
  assert.match(crashed.stderr, /\[fail\] W09 no pudo completar la suite/);
  assert.match(crashed.stdout, /0 casos pasaron; 1 fallaron/);
  result = run();
  assert.equal(result.status, 1);
  saved = report();
  assert.equal(saved.checks.find(c => c.id === "security").exitCode, 1);
  for (const output of [crashed.stdout, crashed.stderr, result.stdout, result.stderr, JSON.stringify(saved)]) assert.ok(!output.includes(sentinel));
  subprocesses(0, 0);
  result = run(); assert.equal(result.status, 0);
  const outcomes = Object.fromEntries(["INSTALL", "BROWSER", "PUBLIC", "PREVIOUS", "LINT", "UNIT", "INTEGRATION", "VERIFY", "E2E"].map(id => [`W09_${id}_OUTCOME`, "success"]));
  result = run(["--finalize-ci"], { ...outcomes, W09_LINT_OUTCOME: "failure" });
  assert.equal(result.status, 1); saved = report();
  assert.equal(saved.checks.find(c => c.id === "lint").status, "fail");
  assert.equal(saved.checks.find(c => c.id === "lint").exitCode, null);
  assert.equal(saved.checks.find(c => c.id === "security").status, "pass");
  // Old SHA, malformed or absent evidence cannot turn omitted security into pass.
  saved.commitSha = "0".repeat(40); writeFileSync(join(fixture, "evaluation-result.json"), JSON.stringify(saved));
  result = run(["--finalize-ci"], outcomes); assert.equal(result.status, 1);
  assert.equal(report().checks.find(c => c.id === "security").status, "not-run");
  result = run(["--report-only"]); assert.equal(result.status, 1);
  assert.ok(report().checks.every(c => c.status === "not-run" && c.exitCode === null));
  rmSync(join(fixture, "public-tests/check-w09.sh"));
  result = run(); assert.equal(result.status, 1);
  assert.equal(report().checks.find(c => c.id === "w09-contract").status, "fail");
  assert.equal(report().checks.find(c => c.id === "security").status, "pass");
  rmSync(join(fixture, "evaluation-result.json")); mkdirSync(join(fixture, "evaluation-result.json"));
  result = run(["--report-only"]); assert.equal(result.status, 1);
  console.log("verify-w09.spec.mjs: PASS (fallos, omisiones, redacción, SHA y escritura)");
} finally { rmSync(temp, { recursive: true, force: true }); }
