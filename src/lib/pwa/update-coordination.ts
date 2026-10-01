import { pauseBrowserQueueForUpdate, resumeBrowserQueueAfterUpdate } from "./sync/browser-runner";

type Flush = () => Promise<void>;
const flushers = new Set<Flush>();
const mutations = new Set<Promise<unknown>>();
let preparing = false;

export function isPwaUpdatePreparing(): boolean {
  return preparing;
}

export function registerPwaUpdateFlusher(flush: Flush): () => void {
  flushers.add(flush);
  return () => { flushers.delete(flush); };
}

export function trackPwaMutation<T>(work: () => Promise<T>): Promise<T> {
  const task = work();
  mutations.add(task);
  void task.finally(() => mutations.delete(task)).catch(() => {});
  return task;
}

export async function preparePwaUpdate(): Promise<void> {
  if (preparing) throw new Error("Ya se está preparando una actualización.");
  preparing = true;
  window.dispatchEvent(new Event("pwa-utt:update-preparing"));
  try {
    // Stop new sends first. The active request may still receive an ACK, which
    // the runner persists before releasing its lease.
    const idle = pauseBrowserQueueForUpdate();
    await Promise.all(Array.from(flushers, (flush) => flush()));
    await Promise.all(Array.from(mutations));
    await idle;
    if (!preparing) throw new Error("Se canceló la preparación de la actualización.");
  } catch (error) {
    cancelPwaUpdatePreparation();
    throw error;
  }
}

export function cancelPwaUpdatePreparation(): void {
  if (!preparing) return;
  preparing = false;
  window.dispatchEvent(new Event("pwa-utt:update-cancelled"));
  resumeBrowserQueueAfterUpdate();
}
