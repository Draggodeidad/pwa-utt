import type { SupabaseClient } from "@supabase/supabase-js";
import type { InspectionDetail, InspectionEditorValues, InspectionListItem } from "@/features/inspections";

type InspectionRow = {
  id: string; folio_number: number; laboratory_id: string | null; inspector_id: string;
  inspection_date: string | null; summary: string; workflow_status: "draft" | "completed";
};
type FindingRow = { id: string; inspection_id: string; title: string; description: string; priority: "low" | "medium" | "high"; status: "pending" | "in_review" | "resolved" };
type LaboratoryRow = { id: string; code: string; name: string };
type ProfileRow = { id: string; display_name: string };

export class InspectionReadError extends Error {
  constructor() { super("No fue posible consultar las inspecciones"); }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isInspectionId(value: string) { return uuid.test(value); }

export async function hasVisibleInspection(client: SupabaseClient, id: string): Promise<boolean> {
  if (!isInspectionId(id)) return false;
  const { data, error } = await client.from("inspections").select("id")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new InspectionReadError();
  return !!data;
}

export async function hasEditableInspection(client: SupabaseClient, id: string, actorId: string): Promise<boolean> {
  if (!isInspectionId(id)) return false;
  const { data, error } = await client.from("inspections").select("id")
    .eq("id", id).eq("inspector_id", actorId).eq("workflow_status", "draft")
    .is("deleted_at", null).maybeSingle();
  if (error) throw new InspectionReadError();
  return !!data;
}

/** Every query uses the caller's cookie session and PostgreSQL RLS. */
export async function findVisibleInspection(client: SupabaseClient, id: string): Promise<InspectionDetail | null> {
  if (!isInspectionId(id)) return null;
  const { data, error } = await client.from("inspections")
    .select("id, folio_number, laboratory_id, inspector_id, inspection_date, summary, workflow_status")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new InspectionReadError();
  if (!data) return null;
  const row = data as InspectionRow;
  const [labs, profiles, findings] = await Promise.all([
    row.laboratory_id ? client.from("laboratories").select("id, code, name").eq("id", row.laboratory_id) : Promise.resolve({ data: [], error: null }),
    client.from("profiles").select("id, display_name").eq("id", row.inspector_id),
    client.from("findings").select("id, inspection_id, title, description, priority, status").eq("inspection_id", id).is("deleted_at", null),
  ]);
  if (labs.error || profiles.error || findings.error) throw new InspectionReadError();
  const lab = (labs.data as LaboratoryRow[] | null)?.[0];
  const profile = (profiles.data as ProfileRow[] | null)?.[0];
  const visibleFindings = (findings.data ?? []) as FindingRow[];
  return {
    id: row.id, folio: `INS-${row.folio_number}`, location: lab?.name ?? "Laboratorio no asignado",
    date: row.inspection_date ?? "", technician: profile?.display_name ?? "Responsable no disponible",
    workflowStatus: row.workflow_status, result: visibleFindings.length ? "requires_attention" : "without_findings",
    syncStatus: "synced", scope: row.summary,
    findings: visibleFindings.map(({ id: findingId, title, description, priority, status }) => ({ id: findingId, title, description, priority, status })),
  };
}

export async function findEditableInspection(client: SupabaseClient, id: string, actorId: string): Promise<InspectionEditorValues | null> {
  if (!isInspectionId(id)) return null;
  const { data, error } = await client.from("inspections").select("id, laboratory_id")
    .eq("id", id).eq("inspector_id", actorId).eq("workflow_status", "draft")
    .is("deleted_at", null).maybeSingle();
  if (error) throw new InspectionReadError();
  if (!data) return null;
  const detail = await findVisibleInspection(client, id);
  if (!detail) return null;
  const laboratory = data.laboratory_id
    ? await client.from("laboratories").select("code").eq("id", data.laboratory_id).maybeSingle()
    : { data: null, error: null };
  if (laboratory.error) throw new InspectionReadError();
  return {
    id: detail.id, folio: detail.folio, laboratoryCode: laboratory.data?.code ?? "",
    date: detail.date, technician: detail.technician, summary: detail.scope,
    findings: detail.findings, syncStatus: detail.syncStatus,
  };
}

export async function listVisibleInspections(client: SupabaseClient): Promise<InspectionListItem[]> {
  const { data, error } = await client.from("inspections")
    .select("id, folio_number, laboratory_id, inspector_id, inspection_date, summary, workflow_status")
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw new InspectionReadError();
  const rows = (data ?? []) as InspectionRow[];
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const labIds = Array.from(new Set(rows.map((row) => row.laboratory_id).filter((id): id is string => !!id)));
  const profileIds = Array.from(new Set(rows.map((row) => row.inspector_id)));
  const [labs, profiles, findings] = await Promise.all([
    labIds.length ? client.from("laboratories").select("id, code, name").in("id", labIds) : Promise.resolve({ data: [], error: null }),
    client.from("profiles").select("id, display_name").in("id", profileIds),
    client.from("findings").select("id, inspection_id, title, description, priority, status").in("inspection_id", ids).is("deleted_at", null),
  ]);
  if (labs.error || profiles.error || findings.error) throw new InspectionReadError();
  const labById = new Map(((labs.data ?? []) as LaboratoryRow[]).map((lab) => [lab.id, lab]));
  const profileById = new Map(((profiles.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const counts = new Map<string, number>();
  for (const finding of (findings.data ?? []) as FindingRow[]) counts.set(finding.inspection_id, (counts.get(finding.inspection_id) ?? 0) + 1);
  return rows.map((row) => {
    const lab = row.laboratory_id ? labById.get(row.laboratory_id) : undefined;
    const findingCount = counts.get(row.id) ?? 0;
    return {
      id: row.id, location: lab?.name ?? "Laboratorio no asignado", laboratoryCode: lab?.code ?? "—",
      date: row.inspection_date ?? "", inspector: profileById.get(row.inspector_id)?.display_name ?? "Responsable no disponible",
      result: findingCount ? "requires_attention" : "without_findings", findingCount, syncStatus: "synced",
      workflowStatus: row.workflow_status, summary: row.summary,
    };
  });
}
