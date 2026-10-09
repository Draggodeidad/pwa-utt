import { sendPhotoOperation } from "../../photos/http-client";
import { HttpClient } from "../../api/http-client";
import { LocalStorage } from "../offline-storage";
import { runQueue } from "./runner";
import { completeRemoteLogout, isRemoteLogoutPending, isSessionBlocked, isSessionCurrent, sessionEpoch } from "../offline-session";

let running = false;
let requested = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let updatePaused = false;
let idle: Promise<void> | null = null;
let resolveIdle: (() => void) | null = null;

export async function pauseBrowserQueueForUpdate(): Promise<void> {
  updatePaused = true;
  pauseBrowserQueue();
  await idle;
}

export function resumeBrowserQueueAfterUpdate(): void {
  updatePaused = false;
  if (!isSessionBlocked()) void runBrowserQueue().catch(() => {});
}

export function pauseBrowserQueue(): void {
  requested = false;
  scheduleRetry(null);
}

function scheduleRetry(at: number | null): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = at === null ? null : setTimeout(() => {
    retryTimer = null;
    void runBrowserQueue().catch(() => { /* durable queue remains available on next activation */ });
  }, Math.max(0, at - Date.now()));
}

async function verifiedOwner(epoch: string): Promise<string | null> {
  if (!isSessionCurrent(epoch)) return null;
  try {
    const response = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
    if (!isSessionCurrent(epoch)) return null;
    if (!response.ok) return null;
    const body = await response.json() as { user?: { id?: string } };
    return isSessionCurrent(epoch, body.user?.id) ? body.user?.id ?? null : null;
  } catch {
    return null;
  }
}

async function reconcileLogout(): Promise<void> {
  if (!isRemoteLogoutPending()) return;
  const epoch = sessionEpoch();
  try {
    const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store", credentials: "same-origin" });
    if (response.status === 204) completeRemoteLogout(epoch);
  } catch { /* remain blocked until a later online attempt or fresh login */ }
}

export function isBrowserQueueRunning(): boolean {
  return running;
}

/** Open-app transport with a durable per-account lease and scheduled retries. */
export async function runBrowserQueue(): Promise<void> {
  if (updatePaused) return;
  if (isSessionBlocked()) { scheduleRetry(null); await reconcileLogout(); return; }
  if (running) { requested = true; return; }
  running = true;
  idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pwa-utt:sync-status", { detail: { running: true } }));
  }
  try {
    do {
      requested = false;
      const epoch = sessionEpoch();
      const owner = await verifiedOwner(epoch);
      if (!owner) { scheduleRetry(null); return; }
      const storage = await LocalStorage.open();
      try {
        const outcome = await runQueue(storage, owner, {
          client: new HttpClient(),
          sendPhoto: sendPhotoOperation,
          verifyOwner: async (expected) => isSessionCurrent(epoch, expected) && await verifiedOwner(epoch) === expected,
          shouldContinue: () => !updatePaused,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("pwa-utt:sync-status", { detail: { running: true, outcome } }));
        }
        if (!isSessionCurrent(epoch, owner)) { scheduleRetry(null); return; }
        const pending = await storage.listQueue(owner);
        const next = pending.flatMap((item) => item.nextAttemptAt ? [Date.parse(item.nextAttemptAt)] : []);
        const leaseExpiry = await storage.leaseExpiresAt(owner);
        if (leaseExpiry && leaseExpiry > Date.now()) next.push(leaseExpiry);
        else if (pending.some((item) => item.status === "syncing" && (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= Date.now()))) next.push(Date.now() + 1000);
        scheduleRetry(updatePaused ? null : next.length ? Math.min(...next) : null);
      } finally {
        storage.close();
      }
    } while (requested && !updatePaused);
  } finally {
    running = false;
    resolveIdle?.();
    resolveIdle = null;
    idle = null;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pwa-utt:sync-status", { detail: { running: false } }));
    }
  }
}
