#!/usr/bin/env node
// Generates public/offline-assets.json from the Next build output (.next/static).
// The service worker precaches these essential JS/CSS files so the offline shell
// does not depend on having visited every screen. Runs after `next build`.
import { readdir, stat, writeFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

const baseDir = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), ".next", "static");
const outFile = process.argv[3] ? resolve(process.argv[3]) : resolve(process.cwd(), "public", "offline-assets.json");

async function listFiles(dir) {
  const entries = [];
  let items;
  try {
    items = await readdir(dir);
  } catch {
    return entries;
  }
  for (const item of items) {
    const full = join(dir, item);
    const info = await stat(full);
    if (info.isDirectory()) entries.push(...await listFiles(full));
    else entries.push(full);
  }
  return entries;
}

const files = await listFiles(baseDir);
const assets = files
  .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
  .map((file) => {
    const relative = file.slice(baseDir.length).split(sep).join("/");
    return `/_next/static${relative}`;
  })
  .sort();

await mkdir(resolve(outFile, ".."), { recursive: true });
await writeFile(outFile, JSON.stringify({ version: 1, assets }, null, 2) + "\n");
let buildId;
try {
  buildId = (await readFile(resolve(baseDir, "..", "BUILD_ID"), "utf8")).trim();
} catch {
  buildId = createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 16);
}
await writeFile(resolve(outFile, "..", "sw-build.js"), `self.PWA_BUILD_ID = ${JSON.stringify(buildId)};\n`);
console.log(`offline-assets.json: ${assets.length} essential asset(s)`);
