import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import type { Session, UserRole } from "@/features/auth";
import { readSession } from "./session-store";
import { createComponentSupabaseClient } from "@/lib/supabase/server";

/** UI guards are repeated in Server Components; middleware only refreshes cookies. */
export async function requireRole(roles: readonly UserRole[]): Promise<Session> {
  const session = await readSession(createComponentSupabaseClient());
  if (!session) redirect("/login");
  if (!roles.includes(session.user.role)) notFound();
  return session;
}

export async function authorizeRequest(client: SupabaseClient, roles?: readonly UserRole[]) {
  const session = await readSession(client);
  if (!session) return { error: 401 as const };
  if (roles && !roles.includes(session.user.role)) return { error: 403 as const };
  return { session };
}
