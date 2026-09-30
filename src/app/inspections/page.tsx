import { AppShell } from "@/components/app-shell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { requireServerSession } from "@/lib/auth/session-store";
import { CoordinationInspectionsWorkspace, inspections, InspectionsWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { notFound } from "next/navigation";

export default async function InspectionsPage() {
  const { user } = await requireServerSession();
  const role = user.role;
  if (!isRouteAllowedForRole(role, "/inspections")) notFound();

  return (
    <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      {role === "coordinator" ? <CoordinationInspectionsWorkspace inspections={inspections} /> : <InspectionsWorkspace inspections={inspections} />}
    </AppShell>
  );
}
