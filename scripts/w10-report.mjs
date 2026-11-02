import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

export const assignmentId = "w10-release-rollback";
export const gates = [
  ["install", "npm", ["ci", "--no-audit", "--no-fund"], []],
  ["browser", "npx", ["--no-install", "playwright", "install", ...(process.argv.includes("--with-browser-deps") ? ["--with-deps"] : []), "chromium"], ["install"]],
  ["public", "bash", ["public-tests/check.sh"], []],
  ["w05", "bash", ["public-tests/check-w05.sh"], []],
  ["w06", "bash", ["public-tests/check-w06.sh"], []],
  ["w10-artifacts", "bash", ["public-tests/check-w10.sh", "--artifacts"], []],
  ["w10-documents", "bash", ["public-tests/check-w10.sh", "--documents"], []],
  ["lint", "npm", ["run", "lint"], ["install"]],
  ["unit", "npm", ["run", "test:unit"], ["install"]],
  ["integration", "npm", ["run", "test:integration"], ["install"]],
  ["w10-negatives", "npm", ["run", "test:w10-gates"], ["install"]],
  ["verify", "make", ["verify"], ["install"]],
  ["w09", "npm", ["run", "verify:w09"], ["verify", "browser"]],
  ["e2e", "npm", ["run", "test:e2e"], ["verify", "browser"]],
  ["smoke", "node", ["scripts/run-w10-smoke.mjs"], ["verify", "browser"]],
];

export function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 && !result.error ? result.stdout.trim() : null;
}

export function initialReport(root) {
  const tree = git(root, ["status", "--porcelain"]);
  const version = spawnSync("npm", ["--version"], { cwd: root, encoding: "utf8" });
  const npm = version.status === 0 && /^\d+\.\d+\.\d+$/.test(version.stdout.trim()) ? version.stdout.trim() : null;
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const runId = process.env.GITHUB_RUN_ID ?? null;
  return {
    schemaVersion: 1, assignmentId,
    commitSha: git(root, ["rev-parse", "HEAD"]),
    workingTreeClean: tree === null ? null : tree === "",
    workingTreeCleanAtStart: tree === null ? null : tree === "",
    generatedAt: new Date().toISOString(),
    runtime: { node: process.version, npm },
    ci: { runId, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null },
    runUrl: /^[\w.-]+\/[\w.-]+$/.test(repository) && /^\d+$/.test(runId ?? "")
      ? `https://github.com/${repository}/actions/runs/${runId}` : null,
    status: "fail",
    checks: [
      { id: "runtime", command: "node scripts/check-w10-runtime.mjs", status: "not-run", exitCode: null },
      ...gates.map(([id, executable, args]) => ({ id, command: [executable, ...args].join(" "), status: "not-run", exitCode: null })),
    ],
    artifacts: [],
    academicReview: { status: "pending", evidence: "evidence/individual.md", ownerEvidenceIssue: 110 },
    limits: [
      "Esquema local v1; feedback técnico sin nota, cobertura fabricada ni evaluador privado.",
      "make verify incluye typecheck, npm test, build/postbuild, métricas HTTP y W06. Su desglose se adjunta por SHA.",
      "AC-04 automatiza presencia documental y trazabilidad; contenido W10, evidencia personal y defensa humana siguen pendientes de revisión (#110/#112/#113).",
      "Smoke S1–S4 pertenece a #111. Ausencia, suite vacía, resumen ausente o caso omitido impiden PASS.",
      "No se publica release, hace deploy, merge ni envío LMS. No se acredita BD remota, hardware o reproducibilidad bit a bit.",
      "Los stdout/stderr, entornos, cookies, traces y payloads no se serializan en este reporte ni se suben por este workflow.",
    ],
  };
}

export function finishReport(report, root) {
  const tree = git(root, ["status", "--porcelain"]);
  report.workingTreeClean = tree === null ? null : tree === "";
  report.generatedAt = new Date().toISOString();
  report.status = /^[a-f0-9]{40}$/.test(report.commitSha ?? "") && tree !== null && report.runtime.npm
    && report.checks.every(check => check.status === "pass" && check.exitCode === 0) ? "pass" : "fail";
  return report;
}

// Only an interrupted execution from this exact CI attempt may be finalized.
// Local reports, W09 reports and old SHA/run evidence are never recycled.
export function resumeReport(saved, fresh) {
  if (!fresh.ci.runId || saved.assignmentId !== assignmentId || saved.schemaVersion !== 1
    || saved.commitSha !== fresh.commitSha || saved.ci?.runId !== fresh.ci.runId
    || saved.ci?.attempt !== fresh.ci.attempt || saved.runUrl !== fresh.runUrl
    || JSON.stringify(saved.checks?.map(c => [c.id, c.command])) !== JSON.stringify(fresh.checks.map(c => [c.id, c.command]))
    || !saved.checks.every(c => ["pass", "fail", "not-run"].includes(c.status)
      && (c.exitCode === null || Number.isInteger(c.exitCode))
      && (c.status !== "pass" || c.exitCode === 0)
      && (c.status !== "not-run" || c.exitCode === null))) return fresh;
  return { ...fresh, checks: saved.checks, artifacts: saved.artifacts ?? [],
    workingTreeCleanAtStart: saved.workingTreeCleanAtStart };
}

export function smokeSummary(path, sha, buildId) {
  const saved = JSON.parse(readFileSync(path, "utf8"));
  if (saved.assignmentId !== assignmentId || saved.commitSha !== sha || saved.buildId !== buildId
    || !Array.isArray(saved.checks) || saved.checks.length !== 4) throw new Error("Invalid smoke evidence identity/cases");
  const checks = ["W10-S1", "W10-S2", "W10-S3", "W10-S4"].map(id => {
    const matches = saved.checks.filter(c => c.id === id);
    if (matches.length !== 1) throw new Error("Missing/duplicate smoke case");
    const c = matches[0];
    if (c.status !== "pass" || c.exitCode !== 0) throw new Error("Incomplete smoke case");
    if (id === "W10-S3" && (!Number.isInteger(c.detectedExitCode) || c.detectedExitCode <= 0)) throw new Error("Missing real negative exit");
    return { id, status: c.status, exitCode: c.exitCode, ...(id === "W10-S3" ? { detectedExitCode: c.detectedExitCode } : {}) };
  });
  return { assignmentId, commitSha: sha, buildId, checks };
}

export function observedArtifacts(root, sha, ids) {
  const definitions = [
    ["verify", "reports/verification.json", "accumulated-verification"],
    ["verify", "reports/rendering-metrics.json", "rendering-metrics"],
    ["w09", "reports/w10/w09-evaluation-result.json", "w09-security-privacy"],
    ["smoke", "reports/w10/http.json", "release-http"],
    ["smoke", "reports/w10/smoke.json", "smoke-summary"],
  ];
  return definitions.filter(([id, file]) => ids.has(id) && existsSync(`${root}/${file}`)).flatMap(([, file, kind]) => {
    try {
      const saved = JSON.parse(readFileSync(`${root}/${file}`, "utf8"));
      if (saved.commitSha !== sha) return [];
      return [{ path: file, kind, commitSha: sha,
        ...(typeof saved.buildId === "string" && /^[\w-]{1,128}$/.test(saved.buildId) ? { buildId: saved.buildId } : {}) }];
    } catch { return []; }
  });
}
