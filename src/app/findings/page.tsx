import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireServerSession } from "@/lib/auth/session-store";
import { CoordinationFindingsWorkspace, coordinationFindings } from "@/features/findings";
import { createProfileForSession } from "@/features/profile";

export default async function FindingsPage() {
  const { user } = await requireServerSession();
  if (user.role !== "coordinator") notFound();

  return (
    <AppShell activePath="/findings" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <CoordinationFindingsWorkspace findings={coordinationFindings} />
    </AppShell>
  );
}
