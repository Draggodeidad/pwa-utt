import { AppShell } from "@/components/app-shell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { createProfileForSession, ProfileWorkspace } from "@/features/profile";
import { notFound } from "next/navigation";

export default function ProfilePage() {
  const { user } = temporarySession;
  if (!isRouteAllowedForRole(user.role, "/profile")) notFound();

  return (
    <AppShell activePath="/profile" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <ProfileWorkspace profile={createProfileForSession(user)} />
    </AppShell>
  );
}
