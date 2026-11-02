// Own a production server for the #111 suite; never reuse an unrelated server.
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { git, smokeSummary } from "./w10-report.mjs";

const root = resolve(import.meta.dirname, "..");
const summary = resolve(root, "test-results/w10/smoke-result.json");
let server;
try {
  rmSync(summary, { force: true });
  for (const file of ["tests/smoke.spec.ts", ".next/BUILD_ID"]) {
    if (!existsSync(resolve(root, file)) || !readFileSync(resolve(root, file), "utf8").trim())
      throw new Error(`W10 requires ${file}; smoke implementation belongs to #111, build must precede smoke.`);
  }
  const sha = git(root, ["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Missing Git identity");
  const buildId = readFileSync(resolve(root, ".next/BUILD_ID"), "utf8").trim();
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((done, reject) => reservation.close(error => error ? reject(error) : done()));
  const env = { ...process.env, W10_BASE_URL: `http://127.0.0.1:${port}`, W10_EXPECTED_SHA: sha,
    W10_EXPECTED_BUILD_ID: buildId, NEXT_TELEMETRY_DISABLED: "1",
    SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_ANON_KEY: "sb_publishable_synthetic_w10_fixture" };
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: root, env, stdio: "ignore" });
  let serverError = false;
  server.on("error", () => { serverError = true; });
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => server?.kill(signal));
  // The existing #108 probe waits <=30s, bounds requests to 5s and checks real
  // health/SHA/HTTP/postbuild assets before calling the independent smoke suite.
  const probe = spawnSync(process.execPath, ["scripts/check-release-http.mjs"],
    { cwd: root, env, encoding: "utf8", timeout: 120_000, maxBuffer: 1024 * 1024 });
  if (probe.status !== 0 || probe.error || serverError || server.exitCode !== null) {
    process.exitCode = probe.status && probe.status > 0 ? probe.status : 1;
    throw new Error("W10 production HTTP/identity probe failed (not a skipped smoke)");
  }
  const http = JSON.parse(probe.stdout);
  if (http.commitSha !== sha || http.buildId !== buildId || http.status !== "pass") throw new Error("Unexpected HTTP artifact identity");
  mkdirSync(resolve(root, "reports/w10"), { recursive: true });
  writeFileSync(resolve(root, "reports/w10/http.json"), JSON.stringify({
    status: "pass", commitSha: sha, buildId, assets: http.assets,
  }, null, 2) + "\n");
  const run = spawnSync("npm", ["run", "test:smoke"], { cwd: root, env, stdio: "inherit", timeout: 600_000, killSignal: "SIGKILL", detached: process.platform !== "win32" });
  if (process.platform !== "win32" && run.pid) {
    try { process.kill(-run.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  }
  if (run.status !== 0 || run.error) {
    process.exitCode = run.status && run.status > 0 ? run.status : 1;
    throw new Error("W10 smoke command failed");
  }
  // Exit 0 alone cannot credit an empty/no-op/partially skipped smoke suite.
  const result = smokeSummary(summary, sha, buildId);
  writeFileSync(resolve(root, "reports/w10/smoke.json"), JSON.stringify(result, null, 2) + "\n");
  console.log("W10 smoke: S1–S4 passed; negative exit retained; human review remains pending.");
} catch (error) {
  // Only fixed harness diagnostics are printed; suite payloads are never copied.
  console.error(error.code === "ENOENT" ? "W10 smoke evidence is missing (#111)." : error.message);
  process.exitCode ||= 1;
} finally {
  if (server?.pid && server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill("SIGTERM");
    let timer;
    await Promise.race([stopped, new Promise(done => { timer = setTimeout(() => { server.kill("SIGKILL"); done(); }, 5_000); })]);
    clearTimeout(timer);
  }
}
