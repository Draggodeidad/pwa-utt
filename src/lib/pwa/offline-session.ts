const SESSION_KEY = "pwa-utt:active-session";

export type LocalSession = { userId: string; displayName: string };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Remembers the active user so the offline shell can open their partition. */
export function rememberLocalSession(session: LocalSession): void {
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearLocalSession(): void {
  storage()?.removeItem(SESSION_KEY);
}

/** Returns the remembered session, or null when logged out/unknown. */
export function readLocalSession(): LocalSession | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: unknown; displayName?: unknown };
    if (typeof parsed.userId !== "string" || !parsed.userId || typeof parsed.displayName !== "string") return null;
    return { userId: parsed.userId, displayName: parsed.displayName };
  } catch {
    return null;
  }
}