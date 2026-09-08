import type { UserRole } from "@/features/auth";

export type ProfileView = { displayName: string; role: UserRole; applicationVersion: string };
