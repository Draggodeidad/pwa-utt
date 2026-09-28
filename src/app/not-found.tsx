import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/loading-state";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { createProfileForSession } from "@/features/profile";

export default function NotFound() {
  const { user } = temporarySession;
  return <AppShell navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}><LoadingState state="empty" title="No encontramos lo que buscas" description="La página o inspección solicitada no está disponible." action={<Link className={s.backLink} href="/inspecciones">Ver todas las inspecciones</Link>} /></AppShell>;
}

const s = {
  backLink: "inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
};
