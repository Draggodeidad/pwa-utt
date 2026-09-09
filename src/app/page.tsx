import { AppShell } from "@/components/layout/AppShell";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { inspections, TechnicianHomeWorkspace, technicianHomeData } from "@/features/inspections";

export default function HomePage() {
  const { user } = temporarySession;
  return <AppShell activePath="/" navigationSections={navigationSectionsByRole[user.role]}><TechnicianHomeWorkspace inspections={inspections} data={technicianHomeData} technicianName={user.displayName} /></AppShell>;
}
