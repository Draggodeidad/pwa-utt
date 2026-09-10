import type { UserRole } from "@/features/auth";

export type ProfileView = {
  displayName: string;
  role: UserRole;
  roleLabel: string;
  email?: string;
  institutionalId?: string;
  campusArea?: string;
  avatarUrl?: string;
  deviceName?: string;
};

export type ProfileScreenState = "loading" | "ready" | "error" | "offline";
export type ProfileSignOutState = "idle" | "signing-out" | "error";
