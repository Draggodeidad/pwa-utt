import { requireRole } from "@/lib/auth/guards";
import { listVisibleInspections } from "@/lib/repositories/inspections";
import { createComponentSupabaseClient } from "@/lib/supabase/server";
import { InspectionsClient } from "./inspections-client";

export const dynamic = "force-dynamic";

export default async function InspeccionesPage({ searchParams }: { searchParams?: { estado?: string } }) {
  const { user } = await requireRole(["technician", "coordinator"]);
  const records = await listVisibleInspections(createComponentSupabaseClient());
  return <InspectionsClient user={user} records={records} demoState={searchParams?.estado} />;
}
