import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { gates, initialReport, finishReport, resumeReport, observedArtifacts } from "./w10-report.mjs";

const root = resolve(import.meta.dirname, "..");
let report = initialReport(root);
const reportOnly = process.argv.includes("--report-only");
const output = resolve(root, "evaluation-result.json");
const checkpoint = resolve(root, "reports/w10/evaluation-result.json");
const write = () => {
  finishReport(report, root);
  mkdirSync(resolve(root, "reports/w10"), { recursive: true });
  for (const file of [output, checkpoint]) {
    writeFileSync(`${file}.tmp`, JSON.stringify(report, null, 2) + "\n");
    renameSync(`${file}.tmp`, file);
  }
};

try {
  if (reportOnly) {
    try { report = resumeReport(JSON.parse(readFileSync(checkpoint, "utf8")), report); } catch { /* Remain not-run. */ }
    write();
  } else {
    // Do not infer execution from a file left by another SHA or prior attempt.
    rmSync(resolve(root, "reports/w10"), { recursive: true, force: true });
    rmSync(resolve(root, "test-results/w10/smoke-result.json"), { force: true });
    for (const file of ["reports/verification.json", "reports/rendering-metrics.json", "evaluation-result.json"]) rmSync(resolve(root, file), { force: true });
    const runtime = report.checks[0];
    const runtimeRun = spawnSync(process.execPath, ["scripts/check-w10-runtime.mjs"], { cwd: root, stdio: "inherit", timeout: 30_000 });
    runtime.status = runtimeRun.status === 0 && !runtimeRun.error ? "pass" : "fail";
    runtime.exitCode = runtimeRun.status;
    runtime.signal = runtimeRun.signal ?? null;
    write();
    const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", W10_BUILD_SHA: report.commitSha ?? "",
      SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_ANON_KEY: "sb_publishable_synthetic_w10_fixture", E2E_SKIP_BUILD: "1" };
    const executed = new Set();
    for (const [id, executable, args, dependencies] of gates) {
      const check = report.checks.find(c => c.id === id);
      if (runtime.status !== "pass" || dependencies.some(dependency => report.checks.find(c => c.id === dependency).status !== "pass")) {
        check.reason = "prerequisite-failed-or-not-run";
        write();
        continue;
      }
      console.log(`\nW10 ${id}: ${check.command}`);
      const run = spawnSync(executable === "node" ? process.execPath : executable, args, {
        cwd: root, env, stdio: "inherit", timeout: 900_000, killSignal: "SIGKILL", detached: process.platform !== "win32",
      });
      // A timeout must not leave npm/Next grandchildren running. Each gate owns
      // its process group; never signal the caller's group or another server.
      if (process.platform !== "win32" && run.pid) {
        try { process.kill(-run.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
      }
      check.status = run.status === 0 && !run.error ? "pass" : "fail";
      check.exitCode = run.status;
      check.signal = run.signal ?? null;
      check.executionError = run.error ? (run.error.code ?? "execution-error") : null;
      executed.add(id);
      // W09 owns the same root filename; preserve its identity before writing W10.
      if (id === "w09" && existsSync(output)) {
        try {
          const w09 = JSON.parse(readFileSync(output, "utf8"));
          if (w09.assignmentId === "w09-security-privacy" && w09.commitSha === report.commitSha)
            copyFileSync(output, resolve(root, "reports/w10/w09-evaluation-result.json"));
        } catch { /* No artifact is claimed for malformed evidence. */ }
      }
      report.artifacts = observedArtifacts(root, report.commitSha, executed);
      write();
      console.log(`W10 ${id}: ${check.status}; exitCode=${check.exitCode ?? "unavailable"}`);
    }
  }
  console.log(`W10 ${report.status}: evaluation-result.json; SHA ${report.commitSha}; academic review pending.`);
  process.exitCode = report.status === "pass" ? 0 : 1;
} catch {
  console.error("W10 could not complete/write the technical report.");
  process.exitCode = 1;
}
