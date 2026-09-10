import { AppShell } from "@/components/layout/AppShell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { InspectionEditorWorkspace } from "@/features/inspections/components/InspectionEditorWorkspace";
import { editInspectionValues } from "@/features/inspections/data/inspection-editor";
import { createProfileForSession } from "@/features/profile";
import { notFound } from "next/navigation";
export default function EditInspectionPage({ params }: { params: { inspectionId: string } }) { const role = temporarySession.user.role; if (!isRouteAllowedForRole(role, "/inspections") || params.inspectionId !== editInspectionValues.id) notFound(); return <AppShell activePath="/inspections" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(temporarySession.user)}><InspectionEditorWorkspace mode="edit" initialValues={editInspectionValues} /></AppShell>; }
