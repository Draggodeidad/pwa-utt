import { AppShell } from "@/components/layout/AppShell";
import { isRouteAllowedForRole, navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { InspectionEditorWorkspace } from "@/features/inspections/components/InspectionEditorWorkspace";
import { createInspectionValues } from "@/features/inspections/data/inspection-editor";
import { createProfileForSession } from "@/features/profile";
import { notFound } from "next/navigation";
export default function NewInspectionPage() { const role = temporarySession.user.role; if (!isRouteAllowedForRole(role, "/inspections/new")) notFound(); return <AppShell activePath="/inspections/new" navigationSections={navigationSectionsByRole[role]} profile={createProfileForSession(temporarySession.user)}><InspectionEditorWorkspace mode="create" initialValues={{ ...createInspectionValues, technician: temporarySession.user.displayName }} /></AppShell>; }
