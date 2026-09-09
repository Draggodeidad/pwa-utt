import { AppShell } from "@/components/layout/AppShell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { inspectionDetail, InspectionDetailWorkspace } from "@/features/inspections";
import { notFound } from "next/navigation";

export default function InspectionDetailPage({ params }: { params: { inspectionId: string } }) {
  const role = temporarySession.user.role;
  if (!isRouteAllowedForRole(role, "/inspections") || params.inspectionId !== inspectionDetail.id) notFound();

  return <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]}><InspectionDetailWorkspace inspection={inspectionDetail} /></AppShell>;
}
