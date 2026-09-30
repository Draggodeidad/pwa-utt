import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireRole } from "@/lib/auth/guards";
import { InspectionEditorWorkspace } from "@/features/inspections/components/InspectionEditorWorkspace";
import { createInspectionValues } from "@/features/inspections/data/inspection-editor";
import { createProfileForSession } from "@/features/profile";

export default async function NewInspectionPage() {
  const { user } = await requireRole(["technician"]);
  const role = user.role;

  return (
    <AppShell activePath="/inspections/new" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      <InspectionEditorWorkspace mode="create" initialValues={{ ...createInspectionValues, technician: user.displayName }} />
    </AppShell>
  );
}
