import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const finalize = process.argv.includes("--finalize-ci");
const reportOnly = process.argv.includes("--report-only") || finalize;
const git = args => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 && !result.error ? result.stdout.trim() : null;
};
const commitSha = git(["rev-parse", "HEAD"]);
const tree = git(["status", "--porcelain"]);
const checks = [];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmRun = spawnSync(npm, ["--version"], { cwd: root, encoding: "utf8" });
const npmVersion = npmRun.status === 0 && /^\d+\.\d+\.\d+$/.test(npmRun.stdout.trim()) ? npmRun.stdout.trim() : null;

// When invoked by Actions, preserve failures/omissions from preceding steps.
const prerequisites = {
  install: ["W09_INSTALL_OUTCOME", "npm ci --no-audit --no-fund"],
  browser: ["W09_BROWSER_OUTCOME", "npx playwright install --with-deps chromium"],
  public: ["W09_PUBLIC_OUTCOME", "bash public-tests/check.sh"],
  previous: ["W09_PREVIOUS_OUTCOME", "bash public-tests/check-w05.sh && bash public-tests/check-w06.sh"],
  lint: ["W09_LINT_OUTCOME", "npm run lint"],
  unit: ["W09_UNIT_OUTCOME", "npm run test:unit"],
  integration: ["W09_INTEGRATION_OUTCOME", "npm run test:integration"],
  verify: ["W09_VERIFY_OUTCOME", "make verify"],
  e2e: ["W09_E2E_OUTCOME", "E2E_SKIP_BUILD=1 npm run test:e2e"],
};
for (const [id, [variable, command]] of Object.entries(prerequisites)) {
  const outcome = process.env[variable];
  if (outcome !== undefined || reportOnly) checks.push({
    id, command, status: outcome === "success" ? "pass" : [undefined, "skipped", "cancelled", ""].includes(outcome) ? "not-run" : "fail",
    // Actions exposes an outcome, not the shell exit code. Do not invent one.
    exitCode: outcome === "success" ? 0 : null,
  });
}
for (const [id, command, executable, args] of [
  ["w09-contract", "bash public-tests/check-w09.sh", "bash", ["public-tests/check-w09.sh"]],
  ["security", "npm run test:security", npm, ["run", "test:security"]],
]) {
  if (reportOnly) {
    let prior = null;
    if (finalize) {
      try {
        const saved = JSON.parse(readFileSync(resolve(root, "evaluation-result.json"), "utf8"));
        if (saved.commitSha === commitSha && saved.assignmentId === "w09-security-privacy") {
          const item = saved.checks.find(check => check.id === id && check.command === command);
          if (item && ["pass", "fail", "not-run"].includes(item.status) && (item.exitCode === null || Number.isInteger(item.exitCode)) && (item.status !== "pass" || item.exitCode === 0)) {
            prior = { id, command, status: item.status, exitCode: item.exitCode };
          }
        }
      } catch { /* Missing/malformed evidence must remain not-run, never pass. */ }
    }
    checks.push(prior ?? { id, command, status: "not-run", exitCode: null });
    continue;
  }
  // Do not serialize child stdout/stderr, exception messages, payloads or env.
  const result = spawnSync(executable, args, { cwd: root, env: process.env, encoding: "utf8", timeout: 600000, maxBuffer: 8 * 1024 * 1024 });
  const ok = result.status === 0 && !result.error;
  checks.push({ id, command, status: ok ? "pass" : "fail", exitCode: result.status, signal: result.signal ?? null });
  console.log(`W09 ${id}: ${ok ? "pass" : "fail"}; exitCode=${result.status ?? "unavailable"}`);
}
const repository = process.env.GITHUB_REPOSITORY ?? "";
const runId = process.env.GITHUB_RUN_ID ?? "";
const report = {
  schemaVersion: 1,
  assignmentId: "w09-security-privacy",
  commitSha,
  workingTreeClean: tree === null ? null : tree === "",
  generatedAt: new Date().toISOString(),
  runtime: { node: process.version, npm: npmVersion },
  runUrl: /^[\w.-]+\/[\w.-]+$/.test(repository) && /^\d+$/.test(runId) ? `https://github.com/${repository}/actions/runs/${runId}` : null,
  status: /^[a-f0-9]{40}$/.test(commitSha ?? "") && tree !== null && npmVersion && checks.every(check => check.status === "pass") ? "pass" : "fail",
  checks,
  limits: [
    "Resultado técnico, sin calificación académica ni evaluador privado.",
    "Local: requiere make verify previo; los checks no listados no se acreditan por este reporte.",
    "Smoke owner sintético; #95 amplía la matriz; HTTP no acredita RLS/Storage desplegados, TLS externo ni hardware.",
    "La ausencia de robots de #99 es un fallo real, nunca un skip exitoso ni un archivo creado por la suite.",
    "CSP conserva unsafe-inline para Next/Radix; el riesgo residual XSS permanece.",
    "Sólo se serializan campos permitidos; centinelas dirigidos no son un escáner exhaustivo de secretos/PII.",
    "Retención sin TTL, borrado lógico y fotos originales locales no se convierten en purga o cifrado.",
    "Auditoría de dependencias, revisión humana y verificaciones remotas se registran por separado.",
  ],
};
try {
  writeFileSync(resolve(root, "evaluation-result.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`W09 ${report.status}; evaluation-result.json (SHA ${commitSha ?? "unavailable"}).`);
  process.exitCode = report.status === "pass" ? 0 : 1;
} catch {
  console.error("W09: no se pudo escribir el reporte técnico.");
  process.exitCode = 1;
}
