import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { CoordinationFindingsWorkspace, coordinationFindings } from "@/features/findings";
import { createProfileForSession } from "@/features/profile";

export default function FindingsPage() {
  const { user } = temporarySession;
  if (user.role !== "coordinator") notFound();

  return (
    <AppShell activePath="/findings" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <CoordinationFindingsWorkspace findings={coordinationFindings} />
    </AppShell>
  );
}
