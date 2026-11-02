const assert = require("node:assert/strict");
const { withSupabaseDeadline, SupabaseUnavailableError } = require("../../src/lib/supabase/deadline.ts");

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const originalFetch = globalThis.fetch;

async function main() {
  try {
    for (const status of [429, 500, 503]) {
      globalThis.fetch = async () => new Response("{}", { status });
      await assert.rejects(withSupabaseDeadline(async boundedFetch => {
        await boundedFetch("https://synthetic.invalid");
        return null; // SDK swallowed the transport error.
      }), SupabaseUnavailableError);
    }
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    await assert.rejects(withSupabaseDeadline(async boundedFetch => {
      try { await boundedFetch("https://synthetic.invalid"); } catch {}
      return null;
    }), SupabaseUnavailableError);

    globalThis.fetch = async () => new Response("{}", { status: 401 });
    assert.equal(await withSupabaseDeadline(async boundedFetch => {
      await boundedFetch("https://synthetic.invalid");
      return null;
    }), null, "invalid credentials remain an authentication failure");

    let completedSignal;
    globalThis.fetch = async (_, init) => {
      completedSignal = init.signal;
      return new Response("{}");
    };
    assert.equal(await withSupabaseDeadline(async boundedFetch => {
      await boundedFetch("https://synthetic.invalid");
      return "ok";
    }, 20), "ok");
    await wait(40);
    assert.equal(completedSignal.aborted, false, "successful work clears its timer");

    let calls = 0;
    let aborted = 0;
    globalThis.fetch = (_, init) => new Promise((resolve, reject) => {
      calls++;
      const timer = setTimeout(() => resolve(new Response("{}")), 40);
      init.signal.addEventListener("abort", () => {
        aborted++;
        clearTimeout(timer);
        reject(init.signal.reason);
      }, { once: true });
    });
    await assert.rejects(withSupabaseDeadline(async boundedFetch => {
      await boundedFetch("https://synthetic.invalid/auth");
      await boundedFetch("https://synthetic.invalid/profile");
    }, 60), SupabaseUnavailableError);
    assert.equal(calls, 2);
    assert.ok(aborted > 0, "deadline cancels in-flight fetches across the shared budget");

    // A refresh retry waiting in SDK backoff must not keep the response open or
    // issue more HTTP traffic once the total deadline has elapsed.
    calls = 0;
    globalThis.fetch = async () => { calls++; throw new TypeError("fetch failed"); };
    let retried;
    const retryFinished = new Promise(resolve => { retried = resolve; });
    await assert.rejects(withSupabaseDeadline(async boundedFetch => {
      try { await boundedFetch("https://synthetic.invalid/token"); } catch {}
      await wait(50);
      try {
        await assert.rejects(boundedFetch("https://synthetic.invalid/token"));
      } finally { retried(); }
      return null;
    }, 20), SupabaseUnavailableError);
    await retryFinished;
    assert.equal(calls, 1, "expired SDK retries never reach the network");

    // The overall race also covers stalled response bodies/non-fetch SDK work.
    await assert.rejects(withSupabaseDeadline(() => new Promise(() => {}), 20), SupabaseUnavailableError);
    console.log("supabase-deadline.spec.ts: PASS");
  } finally { globalThis.fetch = originalFetch; }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
