// Disposable fixtures test failures; none are evidence of release/smoke behavior.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { assignmentId, initialReport, resumeReport, smokeSummary } from "../scripts/w10-report.mjs";

const root = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "w10-gates-"));
const fixture = join(temp, "repo");
const sentinel = "synthetic_w10_payload_must_not_be_reported";
try {
  const clone = spawnSync("git", ["clone", "--quiet", "--shared", root, fixture], { encoding: "utf8" });
  assert.equal(clone.status, 0);
  for (const dir of ["scripts", "public-tests", "reports/w10", "test-results/w10", "bin"]) mkdirSync(join(fixture, dir), { recursive: true });
  for (const file of ["scripts/w10-report.mjs", "scripts/verify-w10.mjs", "scripts/run-w10-smoke.mjs", "scripts/check-w10-runtime.mjs", "public-tests/check-w10.sh"])
    copyFileSync(join(root, file), join(fixture, file));
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: fixture, encoding: "utf8" }).stdout.trim();
  const gate = mode => spawnSync("bash", ["public-tests/check-w10.sh", mode], { cwd: fixture, encoding: "utf8" });
  // Real gate: missing artifacts, empty artifacts, missing docs and invalid script.
  assert.equal(gate("--artifacts").status, 1);
  for (const file of ["Dockerfile", "docs/release-process.md", "docs/runbook.md", "tests/smoke.spec.ts",
    ".github/workflows/academic-evaluation.yml", ".github/workflows/week-10-w10-release-rollback.yml", "docs/w10-evaluation.md"])
    writeFileSync(join(fixture, file), "Synthetic structural fixture only\n");
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ scripts: { "test:smoke": "node tests/smoke.spec.ts" } }));
  assert.equal(gate("--artifacts").status, 0);
  for (const file of ["Dockerfile", "docs/release-process.md", "docs/runbook.md", "tests/smoke.spec.ts",
    ".github/workflows/academic-evaluation.yml", ".github/workflows/week-10-w10-release-rollback.yml"]) {
    rmSync(join(fixture, file));
    assert.equal(gate("--artifacts").status, 1, `Must fail for missing ${file}`);
    writeFileSync(join(fixture, file), "Synthetic structural fixture only\n");
  }
  assert.equal(gate("--documents").status, 0);
  writeFileSync(join(fixture, "tests/smoke.spec.ts"), "  \n");
  assert.equal(gate("--artifacts").status, 1);
  const absentSmoke = spawnSync(process.execPath, ["scripts/run-w10-smoke.mjs"], { cwd: fixture, encoding: "utf8" });
  assert.equal(absentSmoke.status, 1);
  assert.match(absentSmoke.stderr, /requires tests\/smoke.spec.ts/);
  writeFileSync(join(fixture, "tests/smoke.spec.ts"), "// synthetic fixture\n");
  rmSync(join(fixture, "README.md"));
  assert.equal(gate("--documents").status, 1);
  writeFileSync(join(fixture, "README.md"), "token password secret api_key: lexical matches are not a security scanner\n");
  assert.equal(gate("--documents").status, 0);
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ scripts: { "test:smoke": "echo success" } }));
  assert.equal(gate("--artifacts").status, 1);

  // Structured smoke must expose all four cases, SHA/BUILD_ID and observed B failure.
  const path = join(temp, "smoke.json");
  const summary = { assignmentId, commitSha: sha, buildId: "fixture-build",
    checks: ["W10-S1", "W10-S2", "W10-S3", "W10-S4"].map(id => ({ id, status: "pass", exitCode: 0,
      ...(id === "W10-S3" ? { detectedExitCode: 7 } : {}), payload: sentinel })) };
  const checkSummary = data => { writeFileSync(path, JSON.stringify(data)); return () => smokeSummary(path, sha, "fixture-build"); };
  assert.ok(!JSON.stringify(checkSummary(summary)()).includes(sentinel));
  for (const changed of [
    { ...summary, assignmentId: "w09-security-privacy" }, { ...summary, commitSha: "0".repeat(40) },
    { ...summary, buildId: "stale" }, { ...summary, checks: [] },
    { ...summary, checks: summary.checks.slice(0, 3) },
    { ...summary, checks: summary.checks.map(c => c.id === "W10-S3" ? { ...c, detectedExitCode: 0 } : c) },
    { ...summary, checks: summary.checks.map(c => c.id === "W10-S4" ? { ...c, status: "not-run" } : c) },
    { ...summary, checks: summary.checks.map(c => c.id === "W10-S4" ? { ...c, id: "W10-S1" } : c) },
  ]) assert.throws(checkSummary(changed));

  const fresh = initialReport(fixture);
  fresh.ci = { runId: "123", attempt: "2" };
  fresh.runUrl = "https://github.com/example/fixture/actions/runs/123";
  const saved = structuredClone(fresh);
  saved.checks = saved.checks.map(c => ({ ...c, status: "pass", exitCode: 0 }));
  assert.equal(resumeReport(saved, fresh).checks[0].status, "pass");
  for (const changed of [
    { ...saved, assignmentId: "w09-security-privacy" }, { ...saved, commitSha: "0".repeat(40) },
    { ...saved, ci: { runId: "122", attempt: "2" } }, { ...saved, ci: { runId: "123", attempt: "1" } },
    { ...saved, checks: [] }, { ...saved, checks: saved.checks.map(c => ({ ...c, exitCode: 9 })) },
  ]) assert.equal(resumeReport(changed, fresh).checks[0].status, "not-run");
  assert.equal(resumeReport(saved, { ...fresh, ci: { runId: null, attempt: null } }).checks[0].status, "not-run");

  // Real orchestration with controlled external command exits, no install/build.
  const script = (name, source) => writeFileSync(join(fixture, "bin", name), `#!/bin/sh\n${source}\n`, { mode: 0o755 });
  script("npm", `if [ "$1" = '--version' ]; then echo "\${FIXTURE_NPM_VERSION:-10.9.8}"; exit 0; fi
if [ "$1" = 'ci' ]; then exit "\${FIXTURE_INSTALL_EXIT:-0}"; fi
if [ "$2" = 'test:smoke' ]; then node tests/fixture-smoke.cjs; exit $?; fi
if [ "$2" = 'verify:w09' ]; then
  printf '{"assignmentId":"w09-security-privacy","commitSha":"%s","checks":[],"payload":"${sentinel}"}' "$W10_BUILD_SHA" > evaluation-result.json
  exit 9
fi
echo '${sentinel}'
exit 0`);
  script("npx", "exit 0");
  script("make", "exit 0");
  // Exercise the real smoke harness against a synthetic HTTP server, including
  // teardown and exit-0-without-report. This does not stand in for the #111 suite.
  mkdirSync(join(fixture, ".next"), { recursive: true });
  mkdirSync(join(fixture, "node_modules/next/dist/bin"), { recursive: true });
  writeFileSync(join(fixture, ".next/BUILD_ID"), "fixture-build\n");
  copyFileSync(join(root, "scripts/check-release-http.mjs"), join(fixture, "scripts/check-release-http.mjs"));
  writeFileSync(join(fixture, "node_modules/next/dist/bin/next"), `
const http = require('node:http');
require('node:fs').writeFileSync('server.pid', String(process.pid));
http.createServer((req, res) => {
  const json = data => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); };
  if (req.url === '/api/health') { res.setHeader('cache-control', 'no-store'); return json({status:'ok',commitSha:process.env.W10_EXPECTED_SHA}); }
  if (req.url === '/api/session') { res.statusCode = 401; return json({error:'unauthorized'}); }
  if (req.url === '/') { res.statusCode=307; res.setHeader('location','/login'); return res.end(); }
  if (req.url === '/offline-assets.json') return json({assets:['/_next/static/fixture.js']});
  if (req.url === '/sw-build.js') return res.end('self.PWA_BUILD_ID = "fixture-build";');
  if (req.url === '/_next/static/fixture.js') { res.setHeader('content-type','application/javascript'); return res.end('/* synthetic */'); }
  res.setHeader('content-type','text/html'); res.end('<html>synthetic</html>');
}).listen(Number(process.argv.at(-1)), '127.0.0.1');
`);
  writeFileSync(join(fixture, "tests/fixture-smoke.cjs"), `
if (process.env.FIXTURE_SMOKE_EXIT) process.exit(Number(process.env.FIXTURE_SMOKE_EXIT));
if (process.env.FIXTURE_SMOKE_NO_REPORT) process.exit(0);
require('node:fs').writeFileSync('test-results/w10/smoke-result.json', JSON.stringify({
  assignmentId:'w10-release-rollback',commitSha:process.env.W10_EXPECTED_SHA,buildId:process.env.W10_EXPECTED_BUILD_ID,
  checks:['W10-S1','W10-S2','W10-S3','W10-S4'].map(id=>({id,status:'pass',exitCode:0,...(id==='W10-S3'?{detectedExitCode:7}:{}),payload:'${sentinel}'}))
}));
`);
  const smokeRun = extra => spawnSync(process.execPath, ["scripts/run-w10-smoke.mjs"], {
    cwd: fixture, encoding: "utf8", timeout: 20000,
    env: { ...process.env, PATH: `${join(fixture, "bin")}:${process.env.PATH}`, ...extra },
  });
  for (const [env, exit] of [[{ FIXTURE_SMOKE_NO_REPORT: "1" }, 1], [{ FIXTURE_SMOKE_EXIT: "7" }, 7], [{}, 0]]) {
    const result = smokeRun(env);
    assert.equal(result.status, exit, result.stderr);
    const pid = Number(readFileSync(join(fixture, "server.pid"), "utf8"));
    assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, "The owned production server must be stopped");
  }
  assert.ok(!readFileSync(join(fixture, "reports/w10/smoke.json"), "utf8").includes(sentinel));
  // Only the disposable child is replaced, never the repository's smoke suite.
  writeFileSync(join(fixture, "scripts/run-w10-smoke.mjs"), "process.exit(13);\n");
  const run = (args = [], extra = {}) => spawnSync(process.execPath, ["scripts/verify-w10.mjs", ...args], {
    cwd: fixture, encoding: "utf8", timeout: 30000,
    env: { ...process.env, GITHUB_RUN_ID: "", GITHUB_RUN_ATTEMPT: "", PATH: `${join(fixture, "bin")}:${process.env.PATH}`, ...extra },
  });
  const report = () => JSON.parse(readFileSync(join(fixture, "evaluation-result.json"), "utf8"));
  let result = run([], { FIXTURE_INSTALL_EXIT: "7" });
  assert.equal(result.status, 1);
  let actual = report();
  assert.equal(actual.assignmentId, assignmentId);
  assert.equal(actual.commitSha, sha); assert.equal(actual.workingTreeClean, false);
  assert.equal(actual.checks.find(c => c.id === "install").exitCode, 7);
  for (const id of ["browser", "verify", "smoke", "w09", "e2e"]) {
    const check = actual.checks.find(c => c.id === id);
    assert.equal(check.status, "not-run"); assert.equal(check.exitCode, null);
  }
  assert.equal(actual.checks.find(c => c.id === "w10-documents").status, "pass");
  result = run(); assert.equal(result.status, 1); actual = report();
  assert.equal(actual.checks.find(c => c.id === "w09").exitCode, 9);
  assert.equal(actual.checks.find(c => c.id === "smoke").exitCode, 13);
  assert.equal(actual.checks.find(c => c.id === "e2e").status, "pass");
  assert.ok(!JSON.stringify(actual).includes(sentinel));
  assert.equal(JSON.parse(readFileSync(join(fixture, "reports/w10/w09-evaluation-result.json"))).assignmentId, "w09-security-privacy");
  result = run([], { FIXTURE_NPM_VERSION: "0.0.0" });
  assert.equal(result.status, 1);
  assert.equal(report().checks[0].exitCode, 1);
  assert.ok(report().checks.slice(1).every(c => c.status === "not-run" && c.exitCode === null));
  result = run(["--report-only"]); assert.equal(result.status, 1);
  assert.ok(report().checks.every(c => c.status === "not-run" && c.exitCode === null));
  rmSync(join(fixture, "evaluation-result.json")); mkdirSync(join(fixture, "evaluation-result.json"));
  assert.equal(run(["--report-only"]).status, 1);
  console.log("verify-w10.spec.mjs: PASS (real gate failures, exact exits, skips, SHA/attempt isolation, smoke negatives)");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
