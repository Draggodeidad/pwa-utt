import type { SessionUser } from "@/features/auth";
import type { ProfileView } from "../types";

const roleLabels = {
  technician: "Técnico de mantenimiento TI",
  coordinator: "Coordinación",
} as const;

/** Builds the profile from the verified active session. */
export function createProfileForSession(user: SessionUser): ProfileView {
  return {
    displayName: user.displayName,
    role: user.role,
    roleLabel: roleLabels[user.role],
    email: user.email,
  };
}
