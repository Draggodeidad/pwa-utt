import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Session, SessionUser, UserRole } from "@/features/auth";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

/** Auth identity is revalidated remotely; the profile determines active status and role. */
export async function readSession(client: SupabaseClient): Promise<Session | null> {
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || !identity.user) return null;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, display_name, role, active")
    .eq("id", identity.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.active !== true ||
      (profile.role !== "technician" && profile.role !== "coordinator") ||
      typeof profile.display_name !== "string") return null;

  const { data: authSession, error: sessionError } = await client.auth.getSession();
  if (sessionError || !authSession.session?.expires_at) return null;

  const user: SessionUser = {
    id: identity.user.id,
    displayName: profile.display_name,
    role: profile.role as UserRole,
    email: identity.user.email,
  };
  return { user, expiresAt: new Date(authSession.session.expires_at * 1000).toISOString() };
}

export async function getServerSession() {
  if (cookies().get("pwa-utt-logout-blocked")?.value === "1") return null;
  return readSession(createComponentSupabaseClient());
}

export async function requireServerSession(): Promise<Session> {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session;
}
