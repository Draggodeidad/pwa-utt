import { AppShell } from "@/components/layout/AppShell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { inspections, InspectionsWorkspace } from "@/features/inspections";
import { notFound } from "next/navigation";

export default function InspectionsPage() {
  const role = temporarySession.user.role;
  if (!isRouteAllowedForRole(role, "/inspections")) notFound();

  return (
    <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]}>
      <InspectionsWorkspace inspections={inspections} />
    </AppShell>
  );
}
