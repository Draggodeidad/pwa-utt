// Single W06 runner. Suite implementation belongs to #71/#72, not the baseline.
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const suites = [
  ["helpers/capabilities-camera.ts", "runCameraCapabilitiesSuite"],
  ["helpers/capabilities-geolocation-notifications.ts", "runGeolocationNotificationsSuite"],
];

async function main() {
  // Validate both modules before running either; missing suites never count as PASS.
  const loaded = suites.map(([file, exportName]) => {
    const path = join(__dirname, file);
    let content;
    try { content = readFileSync(path, "utf8"); }
    catch (error) { throw new Error(`W06_SUITE_MISSING: ${file}`, { cause: error }); }
    if (!content.trim()) throw new Error(`W06_SUITE_EMPTY: ${file}`);
    const suite = require(path)[exportName];
    if (typeof suite !== "function") throw new Error(`W06_SUITE_EXPORT_INVALID: ${exportName} (${file})`);
    return { file, suite };
  });
  for (const { file, suite } of loaded) {
    const count = await suite();
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new Error(`W06_SUITE_NO_SCENARIOS: ${file}`);
    }
    console.log(`${file}: PASS (${count} scenarios)`);
  }
  console.log("capabilities.spec.ts: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
