"use strict";

const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Ejecuta E2E mediante `npm run test:e2e` para aislar la configuración de Supabase.");

const env = {
  ...process.env,
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: "sb_publishable_synthetic_w09_fixture",
  NEXT_TELEMETRY_DISABLED: "1",
};
let activeChild;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => activeChild?.kill(signal));
}

function run(args) {
  return new Promise((resolveExit) => {
    activeChild = spawn(process.execPath, args, { stdio: "inherit", env });
    activeChild.once("error", (error) => {
      console.error(error);
      resolveExit(1);
    });
    activeChild.once("exit", (code, signal) => {
      activeChild = null;
      resolveExit(code ?? (signal ? 1 : 0));
    });
  });
}

async function main() {
  if (process.env.E2E_SKIP_BUILD === "1") {
    if (!existsSync(resolve(__dirname, "../../.next/BUILD_ID"))) {
      console.error("E2E_SKIP_BUILD=1 requiere una build existente; ejecuta `npm run build` antes.");
      return 1;
    }
  } else {
    const buildExit = await run([npmCli, "run", "build"]);
    if (buildExit !== 0) return buildExit;
  }

  const playwrightCli = resolve(__dirname, "../../node_modules/@playwright/test/cli.js");
  return run([playwrightCli, "test", "--config=playwright.config.mjs"]);
}

main().then((code) => { process.exitCode = code; });
