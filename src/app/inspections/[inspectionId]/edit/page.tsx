import { AppShell } from "@/components/app-shell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { requireServerSession } from "@/lib/auth/session-store";
import { InspectionEditorWorkspace } from "@/features/inspections/components/InspectionEditorWorkspace";
import { editInspectionValues } from "@/features/inspections/data/inspection-editor";
import { createProfileForSession } from "@/features/profile";
import { notFound } from "next/navigation";

export default async function EditInspectionPage({ params }: { params: { inspectionId: string } }) {
  const { user } = await requireServerSession();
  const role = user.role;
  if (!isRouteAllowedForRole(role, "/inspections") || params.inspectionId !== editInspectionValues.id) notFound();

  return (
    <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      <InspectionEditorWorkspace mode="edit" initialValues={editInspectionValues} />
    </AppShell>
  );
}
