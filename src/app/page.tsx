import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { requireServerSession } from "@/lib/auth/session-store";
import { inspections, TechnicianHomeWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";

export default async function HomePage() {
  const { user } = await requireServerSession();
  return <AppShell activePath="/" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}><TechnicianHomeWorkspace inspections={inspections} technicianName={user.displayName} /></AppShell>;
}
