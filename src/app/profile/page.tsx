import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createProfileForSession, ProfileWorkspace } from "@/features/profile";

export default async function ProfilePage() {
  const { user } = await requireRole(["technician", "coordinator"]);

  return (
    <AppShell activePath="/profile" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <ProfileWorkspace profile={createProfileForSession(user)} />
    </AppShell>
  );
}
