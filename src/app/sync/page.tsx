import { AppShell } from "@/components/layout/AppShell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { SyncWorkspace } from "@/features/sync";
import { notFound } from "next/navigation";

export default function SyncPage() {
  const role = temporarySession.user.role;
  if (role !== "technician" || !isRouteAllowedForRole(role, "/sync")) notFound();

  return (
    <AppShell activePath="/sync" navigationSections={navigationSectionsByRole[role]}>
      <SyncWorkspace />
    </AppShell>
  );
}
