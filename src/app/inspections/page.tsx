import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { CoordinationInspectionsWorkspace, LocalInspectionsWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { listActiveLaboratories, listVisibleInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

export default async function InspectionsPage() {
  const { user } = await requireRole(["technician", "coordinator"]);
  const role = user.role;
  const client = createComponentSupabaseClient();
  const inspections = await listVisibleInspections(client);

  return (
    <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      {role === "coordinator" ? (
        <CoordinationInspectionsWorkspace inspections={inspections} />
      ) : (
        <LocalInspectionsWorkspace remote={inspections} catalog={await listActiveLaboratories(client)} owner={user.id} technician={user.displayName} />
      )}
    </AppShell>
  );
}