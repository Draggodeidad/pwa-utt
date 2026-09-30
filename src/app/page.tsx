import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { TechnicianHomeWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { listVisibleInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const { user } = await requireRole(["technician"]);
  const inspections = await listVisibleInspections(createComponentSupabaseClient());
  return <AppShell activePath="/" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}><TechnicianHomeWorkspace inspections={inspections} technicianName={user.displayName} /></AppShell>;
}
