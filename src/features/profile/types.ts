import type { UserRole } from "@/features/auth";

export type ProfileView = {
  displayName: string;
  role: UserRole;
  email: string;
  institutionalId: string;
  campusArea: string;
  deviceName?: string;
};

export type ProfileScreenState = "loading" | "ready" | "error" | "offline";
export type ProfileSignOutState = "idle" | "signing-out" | "error";
