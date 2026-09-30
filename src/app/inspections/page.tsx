import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { CoordinationInspectionsWorkspace, InspectionsWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { listVisibleInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

export default async function InspectionsPage() {
  const { user } = await requireRole(["technician", "coordinator"]);
  const role = user.role;
  const inspections = await listVisibleInspections(createComponentSupabaseClient());

  return (
    <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      {role === "coordinator" ? <CoordinationInspectionsWorkspace inspections={inspections} /> : <InspectionsWorkspace inspections={inspections} />}
    </AppShell>
  );
}
