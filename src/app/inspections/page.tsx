import { AppShell } from "@/components/layout/AppShell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { CoordinationInspectionsWorkspace, inspections, InspectionsWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { notFound } from "next/navigation";

export default function InspectionsPage() {
  const role = temporarySession.user.role;
  if (!isRouteAllowedForRole(role, "/inspections")) notFound();

  return (
    <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(temporarySession.user)}>
      {role === "coordinator" ? <CoordinationInspectionsWorkspace inspections={inspections} /> : <InspectionsWorkspace inspections={inspections} />}
    </AppShell>
  );
}
