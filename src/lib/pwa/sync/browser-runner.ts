import { HttpClient } from "../../api/http-client";
import { LocalStorage } from "../offline-storage";
import { runQueue } from "./runner";

let running = false;
let requested = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry(at: number | null): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = at === null ? null : setTimeout(() => {
    retryTimer = null;
    void runBrowserQueue().catch(() => { /* durable queue remains available on next activation */ });
  }, Math.max(0, at - Date.now()));
}

async function verifiedOwner(): Promise<string | null> {
  try {
    const response = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return null;
    const body = await response.json() as { user?: { id?: string } };
    return body.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Open-app transport with a durable per-account lease and scheduled retries. */
export async function runBrowserQueue(): Promise<void> {
  if (running) { requested = true; return; }
  running = true;
  try {
    do {
      requested = false;
      const owner = await verifiedOwner();
      if (!owner) { scheduleRetry(null); return; }
      const storage = await LocalStorage.open();
      try {
        await runQueue(storage, owner, {
          client: new HttpClient(),
          verifyOwner: async (expected) => await verifiedOwner() === expected,
        });
        const pending = await storage.listQueue(owner);
        const next = pending.flatMap((item) => item.nextAttemptAt ? [Date.parse(item.nextAttemptAt)] : []);
        const leaseExpiry = await storage.leaseExpiresAt(owner);
        if (leaseExpiry && leaseExpiry > Date.now()) next.push(leaseExpiry);
        else if (pending.some((item) => item.status === "syncing" && (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= Date.now()))) next.push(Date.now() + 1000);
        scheduleRetry(next.length ? Math.min(...next) : null);
      } finally {
        storage.close();
      }
    } while (requested);
  } finally {
    running = false;
  }
}
