import type { SessionUser } from "@/features/auth";
import type { ProfileView } from "../types";

export const profilesByUserId: Record<string, ProfileView> = {
  "demo-technician": {
    displayName: "Técnica A",
    role: "technician",
    roleLabel: "Técnico de mantenimiento TI",
    email: "tecnica.a@universidad.edu",
    institutionalId: "U-49102 (TEC-0881)",
    campusArea: "Campus Central Universitario · Decanato de Cómputo",
    deviceName: "Terminal de campo (Tablet Lab-02)",
  },
};

const roleLabels = {
  technician: "Técnico de mantenimiento TI",
  coordinator: "Coordinación",
} as const;

/** Builds the profile from the active session without applying another role's fixture. */
export function createProfileForSession(user: SessionUser): ProfileView {
  const storedProfile = profilesByUserId[user.id];
  const details = storedProfile?.role === user.role ? storedProfile : undefined;

  return {
    displayName: user.displayName,
    role: user.role,
    roleLabel: roleLabels[user.role],
    email: details?.email,
    institutionalId: details?.institutionalId,
    campusArea: details?.campusArea,
    avatarUrl: details?.avatarUrl,
    deviceName: details?.deviceName,
  };
}
