"use client";

import { AppShell, AppShellState } from "@/components/app-shell";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { createProfileForSession } from "@/features/profile";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  const { user } = temporarySession;

  return (
    <AppShell activePath="/" navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <AppShellState
        state="error"
        title="No pudimos abrir el espacio de trabajo"
        description="El fallo se mantuvo dentro de la pantalla actual. Puedes intentar cargarla otra vez."
        onRetry={reset}
      />
    </AppShell>
  );
}
