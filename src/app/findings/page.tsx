import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { CoordinationFindingsWorkspace } from "@/features/findings";
import { createProfileForSession } from "@/features/profile";

export default async function FindingsPage() {
  const { user } = await requireRole(["coordinator"]);

  return (
    <AppShell activePath="/findings" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <CoordinationFindingsWorkspace owner={user.id} />
    </AppShell>
  );
}
