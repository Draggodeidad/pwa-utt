import { requireRole } from "@/lib/auth/guards";
import { InspectionsClient } from "./inspections-client";

export const dynamic = "force-dynamic";

export default async function InspeccionesPage({ searchParams }: { searchParams?: { estado?: string } }) {
  const { user } = await requireRole(["technician", "coordinator"]);
  return <InspectionsClient user={user} demoState={searchParams?.estado} />;
}
