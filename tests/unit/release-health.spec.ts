const assert = require("node:assert/strict");
const { GET } = require("../../src/app/api/health/route.ts");

async function main() {
  const original = process.env.W10_COMMIT_SHA;
  try {
    for (const value of [undefined, "", "a".repeat(39), "a".repeat(41), "g".repeat(40), `${"a".repeat(40)}\n`]) {
      if (value === undefined) delete process.env.W10_COMMIT_SHA;
      else process.env.W10_COMMIT_SHA = value;
      const response = GET();
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(response.headers.get("content-type"), /application\/json/);
      assert.deepEqual(await response.json(), { status: "unavailable" });
    }
    for (const value of ["0123456789abcdef0123456789abcdef01234567", "ABCDEF0123456789ABCDEF0123456789ABCDEF01"]) {
      process.env.W10_COMMIT_SHA = value;
      const response = GET();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { status: "ok", commitSha: value });
    }
  } finally {
    if (original === undefined) delete process.env.W10_COMMIT_SHA;
    else process.env.W10_COMMIT_SHA = original;
  }
  console.log("release-health.spec.ts: PASS (identity boundaries; runtime immutability needs a production build)");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
