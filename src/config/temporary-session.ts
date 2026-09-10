import type { Session } from "@/features/auth";

/** Transitional single source of truth until the SessionStore has an implementation. */
export const temporarySession: Session = {
  user: {
    id: "demo-technician",
    displayName: "Técnica A",
    role: "coordinator",
  },
  expiresAt: "2026-12-31T23:59:59.000Z",
};
