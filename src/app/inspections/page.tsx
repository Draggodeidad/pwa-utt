import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { CoordinationInspectionsWorkspace, LocalInspectionsWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { listActiveLaboratories, listOperationalInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

export default async function InspectionsPage() {
  const { user } = await requireRole(["technician", "coordinator"]);
  const role = user.role;
  const client = createComponentSupabaseClient();
  const inspections = await listOperationalInspections(client, { role, userId: user.id }).catch(() => null);

  return (
    <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      {role === "coordinator" ? (
        <CoordinationInspectionsWorkspace inspections={inspections ?? undefined} />
      ) : (
        <LocalInspectionsWorkspace remote={inspections ?? []} catalog={await listActiveLaboratories(client).catch(() => [])} owner={user.id} technician={user.displayName} error={inspections === null ? new Error("No fue posible cargar las inspecciones") : null} />
      )}
    </AppShell>
  );
}
