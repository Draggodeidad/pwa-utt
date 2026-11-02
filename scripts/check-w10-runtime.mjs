import { spawnSync } from "node:child_process";

const npm = spawnSync("npm", ["--version"], { encoding: "utf8" });
const valid = process.version === "v22.22.3" && npm.status === 0 && !npm.error && npm.stdout.trim() === "10.9.8";
console.log(valid ? "W10 pinned runtime: Node 22.22.3/npm 10.9.8" : "W10 requires Node 22.22.3/npm 10.9.8");
process.exitCode = valid ? 0 : 1;
