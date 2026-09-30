import { AppShell } from "@/components/app-shell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { requireServerSession } from "@/lib/auth/session-store";
import { createProfileForSession, ProfileWorkspace } from "@/features/profile";
import { notFound } from "next/navigation";

export default async function ProfilePage() {
  const { user } = await requireServerSession();
  if (!isRouteAllowedForRole(user.role, "/profile")) notFound();

  return (
    <AppShell activePath="/profile" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <ProfileWorkspace profile={createProfileForSession(user)} />
    </AppShell>
  );
}
