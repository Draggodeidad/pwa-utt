import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
if (git.status !== 0 || !git.stdout.trim()) {
  console.error("No se pudo resolver el SHA evaluado; no se escribirá un reporte sin trazabilidad.");
  process.exitCode = 1;
} else {
  const outcomes = {
    install: process.env.W08_INSTALL_OUTCOME,
    browser: process.env.W08_BROWSER_OUTCOME,
    publicChecks: process.env.W08_PUBLIC_OUTCOME,
    previousChecks: process.env.W08_PREVIOUS_OUTCOME,
    accumulatedVerification: process.env.W08_VERIFY_OUTCOME,
    unit: process.env.W08_UNIT_OUTCOME,
    integration: process.env.W08_INTEGRATION_OUTCOME,
    e2e: process.env.W08_E2E_OUTCOME,
  };
  const commands = {
    install: "npm ci --no-audit --no-fund",
    browser: "npx playwright install --with-deps chromium",
    publicChecks: "bash public-tests/check.sh",
    previousChecks: "bash public-tests/check-w05.sh && bash public-tests/check-w06.sh",
    accumulatedVerification: "make verify",
    unit: "npm run test:unit",
    integration: "npm run test:integration",
    e2e: "E2E_SKIP_BUILD=1 npm run test:e2e",
  };
  const checks = Object.entries(outcomes).map(([id, outcome]) => ({
    id,
    command: commands[id],
    status: outcome === "success" ? "pass" : "fail",
    outcome: outcome ?? "not-run",
  }));
  const report = {
    schemaVersion: 1,
    workflow: "academic-evaluation.yml",
    generatedAt: new Date().toISOString(),
    commitSha: git.stdout.trim(),
    runUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
    runtime: { node: process.version },
    status: checks.every(check => check.status === "pass") ? "pass" : "fail",
    checks,
    academicReview: {
      status: "pending",
      message: "Este workflow informa resultados técnicos; no asigna calificación académica.",
    },
    limits: [
      "La suite de integración HTTP usa un backend sintético y no acredita RLS remota.",
      "E2E ejecuta el flujo crítico en Chromium con backend sintético; no acredita hardware físico ni otros navegadores.",
      "El reporte no incluye estado de sesión, cookies, credenciales ni tokens.",
    ],
  };

  mkdirSync(resolve(root, "reports"), { recursive: true });
  writeFileSync(resolve(root, "reports/academic-evaluation.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Reporte W08 para ${report.commitSha}: ${report.status} (revisión académica pendiente).`);
}
