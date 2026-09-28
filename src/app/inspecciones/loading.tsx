import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/loading-state";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { createProfileForSession } from "@/features/profile";

export default function Loading() {
  const { user } = temporarySession;
  return <AppShell activePath="/inspecciones" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}><LoadingState /></AppShell>;
}
