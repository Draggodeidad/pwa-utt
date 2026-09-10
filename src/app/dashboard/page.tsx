import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { CoordinationDashboardWorkspace, createCoordinationDashboard } from "@/features/dashboard";
import { inspections } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";

export default function DashboardPage() {
  const { user } = temporarySession;
  if (user.role !== "coordinator") notFound();

  return (
    <AppShell activePath="/dashboard" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <CoordinationDashboardWorkspace dashboard={createCoordinationDashboard(inspections)} />
    </AppShell>
  );
}
