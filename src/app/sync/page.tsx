import { AppShell } from "@/components/app-shell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { createProfileForSession } from "@/features/profile";
import { SyncWorkspace } from "@/features/sync";
import { notFound } from "next/navigation";

export default function SyncPage() {
  const role = temporarySession.user.role;
  if (role !== "technician" || !isRouteAllowedForRole(role, "/sync")) notFound();

  return (
    <AppShell activePath="/sync" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(temporarySession.user)}>
      <SyncWorkspace />
    </AppShell>
  );
}
