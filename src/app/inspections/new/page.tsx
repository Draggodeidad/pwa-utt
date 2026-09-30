import { AppShell } from "@/components/app-shell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { requireServerSession } from "@/lib/auth/session-store";
import { InspectionEditorWorkspace } from "@/features/inspections/components/InspectionEditorWorkspace";
import { createInspectionValues } from "@/features/inspections/data/inspection-editor";
import { createProfileForSession } from "@/features/profile";
import { notFound } from "next/navigation";

export default async function NewInspectionPage() {
  const { user } = await requireServerSession();
  const role = user.role;
  if (!isRouteAllowedForRole(role, "/inspections/new")) notFound();

  return (
    <AppShell activePath="/inspections/new" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      <InspectionEditorWorkspace mode="create" initialValues={{ ...createInspectionValues, technician: user.displayName }} />
    </AppShell>
  );
}
