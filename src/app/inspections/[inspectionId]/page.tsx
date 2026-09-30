import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { InspectionDetailWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { findVisibleInspection } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function InspectionDetailPage({ params }: { params: { inspectionId: string } }) {
  const { user } = await requireRole(["technician", "coordinator"]);
  const role = user.role;
  const detail = await findVisibleInspection(createComponentSupabaseClient(), params.inspectionId);
  if (!detail) notFound();

  return <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}><InspectionDetailWorkspace inspection={detail} owner={user.id} /></AppShell>;
}
