import { AppShell, AppShellState } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { createProfileForSession } from "@/features/profile";

export default function Loading() {
  const { user } = temporarySession;

  return (
    <AppShell activePath="/" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <AppShellState state="loading" />
    </AppShell>
  );
}
