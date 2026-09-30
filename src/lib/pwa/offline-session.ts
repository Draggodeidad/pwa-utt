const SESSION_KEY = "pwa-utt:active-session";
const GATE_KEY = "pwa-utt:session-gate";
const GATE_COOKIE = "pwa-utt-logout-blocked";

export type LocalSession = { userId: string; displayName: string };
type SessionGate = { epoch: string; blocked: boolean; remoteLogoutPending: boolean };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function gate(): SessionGate {
  const raw = storage()?.getItem(GATE_KEY);
  if (raw) {
    try {
      const value = JSON.parse(raw) as SessionGate;
      if (typeof value.epoch === "string" && typeof value.blocked === "boolean" && typeof value.remoteLogoutPending === "boolean") return value;
    } catch { /* malformed state remains locked */ }
    return { epoch: "invalid", blocked: true, remoteLogoutPending: true };
  }
  return { epoch: "initial", blocked: false, remoteLogoutPending: false };
}

function setGate(value: SessionGate): void {
  storage()?.setItem(GATE_KEY, JSON.stringify(value));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pwa-utt:session-changed"));
}

function setBlockedCookie(blocked: boolean): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${GATE_COOKIE}=${blocked ? "1" : ""}; Path=/; SameSite=Lax${secure}${blocked ? "" : "; Max-Age=0"}`;
}

export function sessionEpoch(): string { return gate().epoch; }
export function isSessionBlocked(): boolean { return gate().blocked; }
export function isRemoteLogoutPending(): boolean { return gate().remoteLogoutPending; }

export function isSessionCurrent(epoch: string, owner?: string): boolean {
  const current = gate();
  return !current.blocked && current.epoch === epoch && (!owner || readLocalSession()?.userId === owner);
}

/** Blocks every tab before the remote request; old async work loses its epoch. */
export function blockLocalSession(): string | null {
  const owner = readLocalSession()?.userId ?? null;
  storage()?.removeItem(SESSION_KEY);
  setBlockedCookie(true);
  setGate({ epoch: crypto.randomUUID(), blocked: true, remoteLogoutPending: true });
  return owner;
}

/** A completed remote sign-out still requires a fresh online login. */
export function completeRemoteLogout(epoch: string): void {
  const current = gate();
  if (current.epoch === epoch && current.blocked) setGate({ ...current, remoteLogoutPending: false });
}

/** Only a verified response from the online login endpoint may unlock. */
export function establishLocalSession(session: LocalSession): void {
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
  setBlockedCookie(false);
  setGate({ epoch: crypto.randomUUID(), blocked: false, remoteLogoutPending: false });
}

/** Remembers the active user so the offline shell can open their partition. */
export function rememberLocalSession(session: LocalSession): void {
  if (isSessionBlocked()) return;
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearLocalSession(): void {
  storage()?.removeItem(SESSION_KEY);
}

/** Returns the remembered session, or null when logged out/unknown. */
export function readLocalSession(): LocalSession | null {
  if (isSessionBlocked()) return null;
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
