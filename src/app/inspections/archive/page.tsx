import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { CoordinationInspectionsWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { listOperationalInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function InspectionArchivePage({ searchParams }: { searchParams?: { notice?: string } }) {
  const { user } = await requireRole(["coordinator"]);
  const inspections = await listOperationalInspections(createComponentSupabaseClient(), { role: "coordinator", userId: user.id, archived: true }).catch(() => null);
  return <AppShell activePath="/inspections/archive" navigationSections={navigationSectionsByRole.coordinator} profile={createProfileForSession(user)}><CoordinationInspectionsWorkspace inspections={inspections ?? undefined} archived notice={searchParams?.notice} /></AppShell>;
}
