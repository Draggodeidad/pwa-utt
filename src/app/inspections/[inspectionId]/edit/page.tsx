import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { InspectionEditorWorkspace } from "@/features/inspections/components/InspectionEditorWorkspace";
import { createProfileForSession } from "@/features/profile";
import { findEditableInspection } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function EditInspectionPage({ params }: { params: { inspectionId: string } }) {
  const { user } = await requireRole(["technician"]);
  const role = user.role;
  const values = await findEditableInspection(createComponentSupabaseClient(), params.inspectionId, user.id);
  if (!values) notFound();

  return (
    <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      <InspectionEditorWorkspace mode="edit" initialValues={values} />
    </AppShell>
  );
}
