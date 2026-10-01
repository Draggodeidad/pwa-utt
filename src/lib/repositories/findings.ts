import type { SupabaseClient } from "@supabase/supabase-js";
import type { FindingDto, FindingListPage, FindingPriority, FindingStatus } from "@/features/findings";
import type { InspectionWorkflowStatus } from "@/features/inspections";
import { DomainValidationError } from "@/types/entity";

type FindingRow = {
  id: string; inspection_id: string; title: string; description: string;
  created_by: string;
  priority: FindingPriority; status: FindingStatus; version: number;
  created_at: string; updated_at: string; resolved_at: string | null;
};
type InspectionRow = {
  id: string; folio_number: number; laboratory_id: string | null; inspector_id: string;
  inspection_date: string | null; workflow_status: InspectionWorkflowStatus;
};
type LaboratoryRow = { id: string; code: string; name: string };
type ProfileRow = { id: string; display_name: string };

export class FindingReadError extends Error {
  constructor() { super("No fue posible consultar los hallazgos"); }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isFindingId(value: string) { return uuid.test(value); }

export type FindingListQuery = {
  limit?: number;
  cursor?: string;
  inspectionId?: string;
  priority?: FindingPriority;
  status?: FindingStatus;
};

/** Cursor payload for stable (created_at DESC, id DESC) ordering. */
type FindingCursor = { c: string; i: string };

export function parseFindingCursor(value: string): FindingCursor {
  let decoded: string;
  try { decoded = Buffer.from(value, "base64url").toString("utf8"); } catch { throw new DomainValidationError([{ path: "cursor", message: "is invalid" }]); }
  const separator = decoded.lastIndexOf("\u0000");
  if (separator < 0) throw new DomainValidationError([{ path: "cursor", message: "is invalid" }]);
  const c = decoded.slice(0, separator);
  const i = decoded.slice(separator + 1);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(c) || !uuid.test(i)) {
    throw new DomainValidationError([{ path: "cursor", message: "is invalid" }]);
  }
  return { c, i };
}

function encodeFindingCursor(cursor: FindingCursor): string {
  return Buffer.from(`${cursor.c}\u0000${cursor.i}`, "utf8").toString("base64url");
}

/** Every query uses the caller's cookie session and PostgreSQL RLS on findings. */
export async function findVisibleFinding(client: SupabaseClient, id: string): Promise<FindingDto | null> {
  if (!isFindingId(id)) return null;
  const { data, error } = await client.from("findings")
    .select("id, inspection_id, title, description, created_by, priority, status, version, created_at, updated_at, resolved_at")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new FindingReadError();
  if (!data) return null;
  const hydrated = await hydrateFindingItems(client, [data as FindingRow]);
  return hydrated[0] ?? null;
}

export async function listVisibleFindingsPage(client: SupabaseClient, query: FindingListQuery): Promise<FindingListPage> {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  let builder = client.from("findings")
    .select("id, inspection_id, title, description, created_by, priority, status, version, created_at, updated_at, resolved_at")
    .is("deleted_at", null);
  if (query.inspectionId) builder = builder.eq("inspection_id", query.inspectionId);
  if (query.priority) builder = builder.eq("priority", query.priority);
  if (query.status) builder = builder.eq("status", query.status);
  if (query.cursor) {
    const { c, i } = parseFindingCursor(query.cursor);
    builder = builder.or(`created_at.lt."${c}",and(created_at.eq."${c}",id.lt.${i})`);
  }
  builder = builder.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  const { data, error } = await builder;
  if (error) throw new FindingReadError();
  const rows = (data ?? []) as FindingRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = await hydrateFindingItems(client, page);
  const nextCursor = hasMore && page.length > 0
    ? encodeFindingCursor({ c: page[page.length - 1].created_at, i: page[page.length - 1].id })
    : null;
  return { items, nextCursor };
}

async function hydrateFindingItems(client: SupabaseClient, rows: FindingRow[]): Promise<FindingDto[]> {
  if (!rows.length) return [];
  const inspectionIds = Array.from(new Set(rows.map((row) => row.inspection_id)));
  const { data: inspectionRows, error: inspectionError } = await client.from("inspections")
    .select("id, folio_number, laboratory_id, inspector_id, inspection_date, workflow_status").in("id", inspectionIds);
  if (inspectionError) throw new FindingReadError();
  const inspections = (inspectionRows ?? []) as InspectionRow[];
  const inspectionById = new Map(inspections.map((inspection) => [inspection.id, inspection]));
  const labIds = Array.from(new Set(inspections.map((inspection) => inspection.laboratory_id).filter((id): id is string => !!id)));
  const profileIds = Array.from(new Set(inspections.map((inspection) => inspection.inspector_id)));
  const [labs, profiles] = await Promise.all([
    labIds.length ? client.from("laboratories").select("id, code, name").in("id", labIds) : Promise.resolve({ data: [], error: null }),
    client.from("profiles").select("id, display_name").in("id", profileIds),
  ]);
  if (labs.error || profiles.error) throw new FindingReadError();
  const labById = new Map(((labs.data ?? []) as LaboratoryRow[]).map((lab) => [lab.id, lab]));
  const profileById = new Map(((profiles.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  return rows.map((row) => {
    const inspection = inspectionById.get(row.inspection_id);
    const lab = inspection?.laboratory_id ? labById.get(inspection.laboratory_id) : undefined;
    return {
      id: row.id,
      inspectionId: row.inspection_id,
      folio: inspection ? `INS-${inspection.folio_number}` : "INS-?",
      folioNumber: inspection?.folio_number ?? 0,
      location: lab?.name ?? "Laboratorio no asignado",
      laboratoryCode: lab?.code ?? "—",
      inspectionDate: inspection?.inspection_date ?? null,
      date: inspection?.inspection_date ?? "",
      technician: inspection ? (profileById.get(inspection.inspector_id)?.display_name ?? "Responsable no disponible") : "Responsable no disponible",
      title: row.title,
      description: row.description,
      createdBy: row.created_by,
      priority: row.priority,
      status: row.status,
      workflowStatus: inspection?.workflow_status ?? "draft",
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
    };
  });
}
