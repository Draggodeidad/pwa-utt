import { expect, test, type Page } from "@playwright/test";

const technicianEmail = "tech@example.invalid";
const coordinatorEmail = "coord@example.invalid";
const password = "synthetic-password";
const testDate = "2026-10-19";
const laboratory = "Laboratorio E2E";
const summary = "Recorrido crítico de inspección E2E";
const findingTitle = "Cableado expuesto E2E";
const findingDescription = "Se observa aislamiento dañado en equipo sintético.";

type BackendSnapshot = {
  inspections: Array<{ id: string; workflow_status: string; summary: string }>;
  findings: Array<{ id: string; inspection_id: string; title: string }>;
  receipts: Array<{ operationId: string; kind: string; entityId: string }>;
};

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

async function backendSnapshot(): Promise<BackendSnapshot> {
  const backendUrl = process.env.E2E_BACKEND_URL;
  if (!backendUrl) throw new Error("Playwright config did not provide E2E_BACKEND_URL");
  const response = await fetch(`${backendUrl}/__test/state`, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Synthetic backend diagnostics returned HTTP ${response.status}`);
  return response.json() as Promise<BackendSnapshot>;
}

function recordsFor(snapshot: BackendSnapshot, id: string) {
  const findings = snapshot.findings.filter(row => row.inspection_id === id);
  const entityIds = new Set([id, ...findings.map(row => row.id)]);
  return {
    inspections: snapshot.inspections.filter(row => row.id === id),
    findings,
    receipts: snapshot.receipts.filter(row => entityIds.has(row.entityId)),
  };
}

test("técnico captura offline, sincroniza una vez y coordinación ve solo la inspección finalizada", async ({ browser, page }) => {
  const technicianContext = page.context();
  const coordinatorContext = await browser.newContext({ serviceWorkers: "allow" });
  const coordinatorPage = await coordinatorContext.newPage();
  let activePage = page;

  try {
    await test.step("iniciar sesión y confirmar que el shell offline está listo", async () => {
      await signIn(page, technicianEmail);
      await expect(page.getByRole("heading", { name: /Buen día/ })).toBeVisible();
      await expect.poll(() => page.evaluate(async () => {
        if (!navigator.serviceWorker.controller) return false;
        const names = await caches.keys();
        const shellName = names.find(name => name.startsWith("inspecciones-shell-"));
        if (!shellName) return false;
        return Boolean(await (await caches.open(shellName)).match("/offline"));
      })).toBe(true);
    });

    await test.step("validar los campos requeridos y guardar inspección con hallazgo", async () => {
      await page.getByRole("main").getByRole("link", { name: "Nueva inspección" }).click();
      await expect(page.getByRole("heading", { name: "Nueva inspección" })).toBeVisible();
      await technicianContext.setOffline(true);

      await page.getByRole("button", { name: "Finalizar inspección" }).click();
      await expect(page.getByText("Selecciona un laboratorio.")).toBeVisible();
      await expect(page.getByText("Indica una fecha de ejecución.")).toBeVisible();
      await expect(page.getByText("Agrega un resumen técnico.")).toBeVisible();

      await page.getByLabel(/Laboratorio/).selectOption("LAB-E2E");
      await page.getByLabel("Fecha").fill(testDate);
      await page.getByLabel("Resumen").fill(summary);
      await page.getByRole("button", { name: "Agregar hallazgo" }).click();

      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Título").fill(findingTitle);
      await dialog.getByLabel("Descripción").fill(findingDescription);
      await dialog.getByRole("button", { name: "Guardar hallazgo" }).click();
      await expect(page.getByRole("heading", { name: findingTitle })).toBeVisible();
      await expect(page.getByText("Guardado en este dispositivo", { exact: true })).toBeVisible();

      const current = await backendSnapshot();
      expect(current.inspections.some(row => row.summary === summary)).toBe(false);
    });

    let inspectionId = "";
    await test.step("recargar sin red y recuperar la captura desde IndexedDB", async () => {
      await page.goto("/inspections");
      await page.reload();
      await expect(page.getByRole("heading", { name: "Inspecciones locales" })).toBeVisible();
      const detailLink = page.getByRole("link", { name: new RegExp(laboratory) });
      await expect(detailLink).toBeVisible();
      const href = await detailLink.getAttribute("href");
      const match = href?.match(/^\/inspections\/([0-9a-f-]+)$/i);
      expect(match, "la inspección local debe tener un id navegable").not.toBeNull();
      inspectionId = match![1];

      await detailLink.click();
      await expect(page.getByText(summary, { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: findingTitle })).toBeVisible();
      await expect(page.getByText("Borrador", { exact: true })).toBeVisible();

      await page.getByRole("link", { name: "Editar inspección" }).click();
      await expect(page.getByLabel("Resumen")).toHaveValue(summary);
      await expect(page.getByRole("heading", { name: findingTitle })).toBeVisible();
    });

    await test.step("reconectar y sincronizar la captura con el mismo id", async () => {
      await activePage.close();
      await technicianContext.setOffline(false);
      activePage = await technicianContext.newPage();
      await activePage.goto("/sync");
      await expect.poll(async () => {
        const state = await backendSnapshot();
        const records = recordsFor(state, inspectionId);
        return records.inspections.length === 1 && records.findings.length === 1 &&
          records.receipts.some(row => row.kind === "inspection.create") &&
          records.receipts.some(row => row.kind === "finding.create");
      }, { timeout: 45_000 }).toBe(true);
      await expect(activePage.getByText("No hay inspecciones pendientes de sincronización.")).toBeVisible();

      const synced = recordsFor(await backendSnapshot(), inspectionId);
      expect(synced.inspections).toHaveLength(1);
      expect(synced.findings).toHaveLength(1);
      expect(synced.findings[0].title).toBe(findingTitle);
      expect(synced.receipts.map(row => row.kind).sort()).toEqual(["finding.create", "inspection.create"]);
    });

    await test.step("impedir que coordinación vea el borrador", async () => {
      await signIn(coordinatorPage, coordinatorEmail);
      await expect(coordinatorPage.getByRole("heading", { name: "Resumen de Coordinación" })).toBeVisible();
      await coordinatorPage.goto("/inspections");
      await expect(coordinatorPage.getByRole("heading", { name: "Inspecciones activas" })).toBeVisible();
      await expect(coordinatorPage.getByRole("row").filter({ hasText: laboratory })).toHaveCount(0);
    });

    await test.step("finalizar, sincronizar y abrir la inspección como coordinación", async () => {
      await activePage.goto(`/inspections/${inspectionId}`);
      await expect(activePage.getByRole("heading", { name: laboratory })).toBeVisible();
      await expect(activePage.getByRole("heading", { name: findingTitle })).toBeVisible();
      await activePage.getByRole("button", { name: "Finalizar inspección" }).click();

      const confirmation = activePage.getByRole("dialog");
      const confirmButton = confirmation.getByRole("button", { name: "Confirmar y finalizar" });
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();
      await expect(activePage.getByText("Finalización pendiente de sincronizar.")).toBeVisible();

      await activePage.goto("/sync");
      await expect.poll(async () => {
        const state = await backendSnapshot();
        const records = recordsFor(state, inspectionId);
        return records.inspections.length === 1 && records.inspections[0].workflow_status === "completed" &&
          records.receipts.some(row => row.kind === "inspection.finalize");
      }, { timeout: 45_000 }).toBe(true);
      await expect(activePage.getByText("No hay inspecciones pendientes de sincronización.")).toBeVisible({ timeout: 45_000 });

      const finalized = recordsFor(await backendSnapshot(), inspectionId);
      expect(finalized.inspections).toHaveLength(1);
      expect(finalized.findings).toHaveLength(1);
      expect(finalized.receipts.map(row => row.kind).sort()).toEqual([
        "finding.create", "inspection.create", "inspection.finalize",
      ]);
      expect(new Set(finalized.receipts.map(row => row.operationId)).size).toBe(finalized.receipts.length);

      await coordinatorPage.goto("/inspections");
      const completedRow = coordinatorPage.getByRole("row").filter({ hasText: laboratory });
      await expect(completedRow).toHaveCount(1);
      await completedRow.getByRole("link", { name: `Ver detalle de ${laboratory}` }).click();
      await expect(coordinatorPage.getByRole("heading", { name: laboratory })).toBeVisible();
      await expect(coordinatorPage.getByRole("main").getByText("Finalizada", { exact: true }).filter({ visible: true })).toHaveCount(1);
      await expect(coordinatorPage.getByRole("heading", { name: findingTitle })).toBeVisible();
    });
  } finally {
    await coordinatorContext.close();
  }
});
