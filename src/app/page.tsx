import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { TechnicianHomeWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { listActiveLaboratories, listOperationalInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const { user } = await requireRole(["technician"]);
  const client = createComponentSupabaseClient();
  const inspections = await listOperationalInspections(client, { role: "technician", userId: user.id }).catch(() => null);
  const catalog = await listActiveLaboratories(client).catch(() => []);
  return <AppShell activePath="/" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}><TechnicianHomeWorkspace inspections={inspections ?? []} catalog={catalog} owner={user.id} technicianName={user.displayName} error={inspections === null ? new Error("No fue posible cargar las inspecciones") : null} /></AppShell>;
}
