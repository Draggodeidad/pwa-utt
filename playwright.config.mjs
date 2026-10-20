import { createServer } from "node:net";
import { defineConfig } from "@playwright/test";

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

const appPort = Number(process.env.E2E_APP_PORT) || await reservePort();
const backendPort = Number(process.env.E2E_BACKEND_PORT) || await reservePort();
process.env.E2E_APP_PORT = String(appPort);
process.env.E2E_BACKEND_PORT = String(backendPort);
const baseURL = `http://127.0.0.1:${appPort}`;
process.env.E2E_BACKEND_URL = `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "critical-flow.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "test-results/e2e",
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node tests/e2e/launch-app.cjs ${appPort} ${backendPort}`,
    url: `${baseURL}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
