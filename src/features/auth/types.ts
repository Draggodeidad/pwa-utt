export type UserRole = "technician" | "coordinator";

export type SessionUser = {
  id: string;
  displayName: string;
  role: UserRole;
  email?: string;
};

export type Session = { user: SessionUser; expiresAt: string };
