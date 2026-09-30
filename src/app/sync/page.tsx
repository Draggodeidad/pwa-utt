import { AppShell } from "@/components/app-shell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { requireServerSession } from "@/lib/auth/session-store";
import { createProfileForSession } from "@/features/profile";
import { SyncWorkspace } from "@/features/sync";
import { notFound } from "next/navigation";

export default async function SyncPage() {
  const { user } = await requireServerSession();
  const role = user.role;
  if (role !== "technician" || !isRouteAllowedForRole(role, "/sync")) notFound();

  return (
    <AppShell activePath="/sync" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(user)}>
      <SyncWorkspace />
    </AppShell>
  );
}
