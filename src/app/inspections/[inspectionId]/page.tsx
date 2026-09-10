import { AppShell } from "@/components/layout/AppShell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { inspectionDetail, inspections, InspectionDetailWorkspace } from "@/features/inspections";
import type { InspectionDetail } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";
import { notFound } from "next/navigation";

export default function InspectionDetailPage({ params }: { params: { inspectionId: string } }) {
  const role = temporarySession.user.role;
  if (!isRouteAllowedForRole(role, "/inspections")) notFound();
  const listItem = inspections.find((item) => item.id === params.inspectionId);
  if (!listItem) notFound();
  const detail: InspectionDetail = params.inspectionId === inspectionDetail.id ? inspectionDetail : {
    id: listItem.id,
    folio: listItem.id.replace("inspection-", "INS-"),
    location: listItem.location,
    date: listItem.date,
    technician: listItem.inspector,
    workflowStatus: listItem.workflowStatus,
    result: listItem.result,
    syncStatus: listItem.syncStatus,
    scope: listItem.summary,
    findings: listItem.result === "requires_attention" ? [{ id: `${listItem.id}-finding`, title: "Hallazgo pendiente de seguimiento", description: "Observación registrada durante la inspección del laboratorio.", priority: "medium", status: "pending" }] : []
  };

  return <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(temporarySession.user)}><InspectionDetailWorkspace inspection={detail} /></AppShell>;
}
