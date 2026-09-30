import { HttpClient } from "../../api/http-client";
import { LocalStorage } from "../offline-storage";
import { runQueue } from "./runner";

let running = false;
let requested = false;

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

/** Open-app transport. Cross-tab lease and retry scheduling are phase-19. */
export async function runBrowserQueue(): Promise<void> {
  if (running) { requested = true; return; }
  running = true;
  try {
    do {
      requested = false;
      const owner = await verifiedOwner();
      if (!owner) return;
      const storage = await LocalStorage.open();
      try {
        await runQueue(storage, owner, {
          client: new HttpClient(),
          verifyOwner: async (expected) => await verifiedOwner() === expected,
        });
      } finally {
        storage.close();
      }
    } while (requested);
  } finally {
    running = false;
  }
}
