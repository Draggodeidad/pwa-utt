import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { CoordinationDashboardWorkspace, createCoordinationDashboard } from "@/features/dashboard";
import { createProfileForSession } from "@/features/profile";
import { listOperationalInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { user } = await requireRole(["coordinator"]);
  const inspections = await listOperationalInspections(createComponentSupabaseClient(), { role: "coordinator", userId: user.id }).catch(() => null);

  return (
    <AppShell activePath="/dashboard" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <CoordinationDashboardWorkspace dashboard={inspections === null ? undefined : createCoordinationDashboard(inspections)} />
    </AppShell>
  );
}
