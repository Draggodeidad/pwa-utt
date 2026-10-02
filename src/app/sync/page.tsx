import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createProfileForSession } from "@/features/profile";
import { SyncWorkspace } from "@/features/sync";

export default async function SyncPage() {
  const { user } = await requireRole(["technician", "coordinator"]);
  const role = user.role;

  return (
    <AppShell activePath="/sync" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      <SyncWorkspace />
    </AppShell>
  );
}
