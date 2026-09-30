import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { CoordinationDashboardWorkspace, createCoordinationDashboard } from "@/features/dashboard";
import { createProfileForSession } from "@/features/profile";
import { listVisibleInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const { user } = await requireRole(["coordinator"]);
  const inspections = await listVisibleInspections(createComponentSupabaseClient());

  return (
    <AppShell activePath="/dashboard" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <CoordinationDashboardWorkspace dashboard={createCoordinationDashboard(inspections)} />
    </AppShell>
  );
}
