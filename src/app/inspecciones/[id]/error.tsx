"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/loading-state";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { createProfileForSession } from "@/features/profile";

export default function ErrorPage() {
  const { user } = temporarySession;
  return <AppShell navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}><LoadingState state="error" title="No fue posible cargar el detalle" action={<Link className={s.retryLink} href="/inspecciones">Volver al listado</Link>} /></AppShell>;
}

const s = {
  retryLink: "inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
};
