export class SupabaseUnavailableError extends Error {
  constructor() {
    super("Servicio no disponible");
    this.name = "SupabaseUnavailableError";
  }
}

/** One budget for Auth, refresh retries, profile and RLS reads; below Vercel's 25s limit. */
export async function withSupabaseDeadline<T>(
  operation: (boundedFetch: typeof fetch) => Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  const cleanup: (() => void)[] = [];
  let unavailable = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const boundedFetch: typeof fetch = async (input, init) => {
    // SDK refresh retries must never start another network request after expiry.
    controller.signal.throwIfAborted();
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (callerSignal) {
      const abort = () => controller.abort(callerSignal.reason);
      if (callerSignal.aborted) abort();
      else {
        callerSignal.addEventListener("abort", abort, { once: true });
        cleanup.push(() => callerSignal.removeEventListener("abort", abort));
      }
    }
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      unavailable = response.status === 429 || response.status >= 500;
      return response;
    } catch (error) {
      unavailable = true;
      throw error;
    }
  };

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new SupabaseUnavailableError());
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      deadline,
      operation(boundedFetch).then(result => {
        // Supabase can return network failures as { error } instead of throwing.
        // Do not mistake an unavailable backend for an invalid session.
        if (unavailable) throw new SupabaseUnavailableError();
        return result;
      }),
    ]);
  } finally {
    clearTimeout(timer);
    for (const removeListener of cleanup) removeListener();
  }
}
