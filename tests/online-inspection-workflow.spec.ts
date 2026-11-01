// Online inspection workflow test: drives the client repositories and the shared
// finalize use case against a local Supabase stand-in through the real Next
// routes, verifying the D5 gate sequence (login -> create -> save -> reload ->
// finding -> finalize) without a browser. No real credentials or project.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const { resolve } = require("node:path");
const { once } = require("node:events");

const root = resolve(__dirname, "..");
const production = process.env.AUTH_TEST_PRODUCTION === "1";

const { server: backend, ids } = require("./e2e/fixtures/backend.cjs");
const { technicianId, coordinatorId, otherId, laboratoryId, techDraftId, techCompletedId, foreignCompletedId, clientId } = ids;

function cookieClient(base, jar) {
  const call = async (method, path, options = {}) => {
    const headers = { "Content-Type": "application/json", ...(jar.size ? { Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") } : {}) };
    if (options.operationId) headers["Idempotency-Key"] = options.operationId;
    if (method !== "GET") headers.Origin = base;
    const response = await fetch(base + path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    for (const value of response.headers.getSetCookie()) {
      const first = value.split(";", 1)[0];
      const separator = first.indexOf("=");
      const name = first.slice(0, separator), content = first.slice(separator + 1);
      if (content) jar.set(name, content); else jar.delete(name);
    }
    if (!response.ok) {
      let payload = null;
      try { payload = await response.json(); } catch {}
      const error = new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload ?? { code: "UNAVAILABLE", message: error.message };
      throw error;
    }
    if (response.status === 204) return undefined;
    return response.json();
  };
  return {
    get: (path) => call("GET", path),
    post: (path, body, options) => call("POST", path, { body, operationId: options?.operationId }),
    put: (path, body, options) => call("PUT", path, { body, operationId: options?.operationId }),
    patch: (path, body, options) => call("PATCH", path, { body, operationId: options?.operationId }),
    delete: (path, options) => call("DELETE", path, { body: options?.body, operationId: options?.operationId }),
  };
}

async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port; server.close(); await once(server, "close"); return port;
}

async function main() {
  backend.listen(0, "127.0.0.1"); await once(backend, "listening");
  const supabaseUrl = `http://127.0.0.1:${backend.address().port}`;
  const appPort = await freePort();
  const base = `http://127.0.0.1:${appPort}`;
  const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), production ? "start" : "dev", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: "sb_publishable_synthetic_w09_fixture" },
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-2000); });
  child.stderr.on("data", (chunk) => { output = `${output}${chunk}`.slice(-2000); });

  const { RemoteInspectionRepository } = require("../src/features/inspections/services/remote-inspection.repository.ts");
  const { RemoteFindingRepository } = require("../src/features/findings/services/remote-finding.repository.ts");
  const { finalizeInspection } = require("../src/features/inspections/services/finalize-inspection.ts");

  try {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Next terminated: ${output}`);
      try { const ready = await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) }); if (ready.ok) break; } catch {}
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }

    const techJar = new Map();
    const login = async (email, jar) => {
      const response = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "synthetic-password" }),
        redirect: "manual",
      });
      for (const value of response.headers.getSetCookie()) {
        const first = value.split(";", 1)[0];
        const separator = first.indexOf("=");
        const name = first.slice(0, separator), content = first.slice(separator + 1);
        if (content) jar.set(name, content); else jar.delete(name);
      }
      assert.equal(response.status, 200, "login técnico");
    };
    await login("tech@example.invalid", techJar);

    const inspectionsRepo = new RemoteInspectionRepository(cookieClient(base, techJar));
    const findingsRepo = new RemoteFindingRepository(cookieClient(base, techJar));

    const initialList = await inspectionsRepo.list();
    assert.ok(initialList.some((item) => item.id === techDraftId), "el técnico ve sus inspecciones");

    const newInspectionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";
    const created = await inspectionsRepo.create(newInspectionId, { laboratoryId, inspectionDate: "2026-09-22", summary: "Revisión nueva" });
    assert.equal(created.entityType, "inspection");
    assert.equal(created.version, 1);
    assert.equal(created.entityId, newInspectionId);

    assert.equal((await inspectionsRepo.getDetail(newInspectionId)).id, newInspectionId, "el detalle recupera la nueva inspección");

    const detail = await inspectionsRepo.getDetail(newInspectionId);
    assert.equal(detail.workflowStatus, "draft");

    const updated = await inspectionsRepo.update(newInspectionId, 1, { summary: "Revisión nueva editada" });
    assert.equal(updated.version, 2, "guardar borrador incrementa versión");

    const findingId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11";
    const findingAck = await findingsRepo.create(findingId, { inspectionId: newInspectionId, title: "Cableado expuesto", description: "Revisión de cableado", priority: "medium" });
    assert.equal(findingAck.entityType, "finding");
    assert.equal(findingAck.version, 1);

    const newFindingId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12";
    const result = await finalizeInspection({
      inspectionId: newInspectionId,
      inspectionVersion: 2,
      inspectionDraft: { summary: "Revisión nueva editada" },
      inspectionDirty: true,
      findings: [
        { id: findingId, version: 1, title: "Cableado expuesto", description: "Revisión de cableado", priority: "medium", status: "pending", pendingUpdate: true },
        { id: newFindingId, version: null, title: "Ventilador ruidoso", description: "Ventilador del equipo 7", priority: "low", status: "pending" },
      ],
      inspectionRepository: inspectionsRepo,
      findingRepository: findingsRepo,
    });
    assert.equal(result.workflowStatus, "completed");
    assert.equal(result.syncStatus, "synced");

    const finalizedDetail = await inspectionsRepo.getDetail(newInspectionId);
    assert.equal(finalizedDetail.workflowStatus, "completed", "la finalización persiste el estado");
    assert.equal(finalizedDetail.scope, "Revisión nueva editada", "la captura guardada en finalize es la vigente");
    assert.equal(finalizedDetail.findings.length, 2, "ambos hallazgos se confirman con ACK");

    await assert.rejects(() => inspectionsRepo.update(newInspectionId, 3, { summary: "Tarde" }), (error) => error.status === 409, "finalizada bloquea captura posterior");
    await assert.rejects(() => findingsRepo.delete(findingId, 2), (error) => error.status === 404, "hallazgo de finalizada no se elimina");

    const coordJar = new Map();
    await login("coord@example.invalid", coordJar);
    const coordRepo = new RemoteInspectionRepository(cookieClient(base, coordJar));
    assert.equal((await coordRepo.getDetail(newInspectionId)).workflowStatus, "completed", "coordinación lee la finalizada por API");

    const discardId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02";
    const discardCreated = await inspectionsRepo.create(discardId, { summary: "Para descartar" });
    const discarded = await inspectionsRepo.discard(discardId, discardCreated.version);
    assert.equal(discarded.version, 2, "el descarte entrega el ACK");
    assert.equal(await inspectionsRepo.getDetail(discardId), null, "el descarte elimina el borrador del listado");
    await assert.rejects(() => inspectionsRepo.discard(discardId, 1), (error) => error.status === 404, "no hay resurrección tras descartar");

    console.log("online-inspection-workflow.spec.ts: PASS");
  } finally {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), new Promise((done) => setTimeout(done, 5000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
    backend.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });