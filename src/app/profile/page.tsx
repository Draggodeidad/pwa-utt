import { AppShell } from "@/components/layout/AppShell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { ProfileWorkspace, profilesByUserId } from "@/features/profile";
import { notFound } from "next/navigation";

export default function ProfilePage() {
  const { user } = temporarySession;
  if (user.role !== "technician" || !isRouteAllowedForRole(user.role, "/profile")) notFound();

  return (
    <AppShell activePath="/profile" navigationSections={navigationSectionsByRole[user.role]}>
      <ProfileWorkspace profile={profilesByUserId[user.id]} />
    </AppShell>
  );
}
