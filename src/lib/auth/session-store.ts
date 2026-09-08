import type { Session } from "@/features/auth";

/** Infrastructure contract; the eventual implementation must not clear local drafts on logout. */
export interface SessionStore {
  get(): Promise<Session | null>;
  set(session: Session): Promise<void>;
  clear(): Promise<void>;
}
