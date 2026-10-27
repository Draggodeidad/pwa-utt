"use strict";

const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { resolve } = require("node:path");
const { server: backend } = require("./fixtures/backend.cjs");

const [appPort, backendPort] = process.argv.slice(2).map(Number);
if (![appPort, backendPort].every(port => Number.isInteger(port) && port > 0 && port < 65536)) {
  throw new Error("Usage: node launch-app.cjs <app-port> <backend-port>");
}

async function main() {
  backend.listen(backendPort, "127.0.0.1");
  await once(backend, "listening");

  const nextBin = resolve(__dirname, "../../node_modules/next/dist/bin/next");
  const app = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: resolve(__dirname, "../.."),
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_URL: `http://127.0.0.1:${backendPort}`,
      SUPABASE_ANON_KEY: "sb_publishable_synthetic_w09_fixture",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  let stopping = false;
  const stop = signal => {
    if (stopping) return;
    stopping = true;
    if (backend.listening) backend.close();
    if (app.exitCode === null) {
      app.kill(signal);
      const force = setTimeout(() => app.kill("SIGKILL"), 8_000);
      force.unref();
    }
  };

  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
  app.once("exit", (code, signal) => {
    if (!stopping) {
      stopping = true;
      if (backend.listening) backend.close();
      process.exitCode = code ?? (signal ? 1 : 0);
    }
  });
}

main().catch(error => {
  console.error(error);
  if (backend.listening) backend.close();
  process.exitCode = 1;
});
