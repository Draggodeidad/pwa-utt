import { AppShell } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { inspections, TechnicianHomeWorkspace } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";

export default function HomePage() {
  const { user } = temporarySession;
  return <AppShell activePath="/" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}><TechnicianHomeWorkspace inspections={inspections} technicianName={user.displayName} /></AppShell>;
}
