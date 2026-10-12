import type { SupabaseClient } from "@supabase/supabase-js";
import type { InspectionDetail, InspectionEditorValues, InspectionListItem, InspectionWorkflowStatus } from "@/features/inspections";
import { DomainValidationError } from "../../types/entity.ts";

import type { InspectionLocation } from "../../features/inspections/types.ts";
import type { UserRole } from "../../features/auth/types.ts";

type InspectionRow = {
  id: string; folio_number: number; laboratory_id: string | null; inspector_id: string;
  inspection_date: string | null; summary: string; workflow_status: "draft" | "completed";
  version: number; review_status: "pending" | "approved" | "rejected"; review_notes: string;
  reviewed_at: string | null; reviewed_by: string | null; archived_at: string | null; archived_by: string | null;
};
type FindingRow = { id: string; inspection_id: string; title: string; description: string; priority: "low" | "medium" | "high"; status: "pending" | "in_review" | "resolved"; version: number };
type LaboratoryRow = { id: string; code: string; name: string };
type ProfileRow = { id: string; display_name: string };

export class InspectionReadError extends Error {
  constructor() { super("No fue posible consultar las inspecciones"); }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isInspectionId(value: string) { return uuid.test(value); }

export type InspectionListQuery = {
  limit?: number;
  cursor?: string;
  search?: string;
  status?: InspectionWorkflowStatus;
  inspectorId?: string;
  archived?: boolean;
};

export type InspectionListPage = {
  items: InspectionListItem[];
  nextCursor: string | null;
};

/** Cursor payload for stable (inspection_date DESC NULLS LAST, id DESC) ordering. */
type InspectionCursor = { d: string | null; i: string };

export function parseInspectionCursor(value: string): InspectionCursor {
  let decoded: string;
  try { decoded = Buffer.from(value, "base64url").toString("utf8"); } catch { throw new DomainValidationError([{ path: "cursor", message: "is invalid" }]); }
  const separator = decoded.lastIndexOf("\u0000");
  if (separator < 0) throw new DomainValidationError([{ path: "cursor", message: "is invalid" }]);
  const rawDate = decoded.slice(0, separator);
  const i = decoded.slice(separator + 1);
  const d = rawDate === "null" ? null : rawDate;
  if ((d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) || !uuid.test(i)) {
    throw new DomainValidationError([{ path: "cursor", message: "is invalid" }]);
  }
  return { d, i };
}

function encodeInspectionCursor(cursor: InspectionCursor): string {
  return Buffer.from(`${cursor.d ?? "null"}\u0000${cursor.i}`, "utf8").toString("base64url");
}

export async function listActiveLaboratories(client: SupabaseClient) {
  const { data, error } = await client.from("laboratories")
    .select("id, code, name").eq("active", true).order("code");
  if (error) throw new InspectionReadError();
  return (data ?? []) as LaboratoryRow[];
}

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
export async function findVisibleInspection(client: SupabaseClient, id: string, role?: UserRole): Promise<InspectionDetail | null> {
  if (!isInspectionId(id)) return null;
  const { data, error } = await client.from("inspections")
    .select("id, folio_number, laboratory_id, inspector_id, inspection_date, summary, workflow_status, version, review_status, review_notes, reviewed_at, reviewed_by, archived_at, archived_by")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new InspectionReadError();
  if (!data) return null;
  const row = data as InspectionRow;
  const [labs, profiles, findings] = await Promise.all([
    row.laboratory_id ? client.from("laboratories").select("id, code, name").eq("id", row.laboratory_id) : Promise.resolve({ data: [], error: null }),
    client.from("profiles").select("id, display_name").eq("id", row.inspector_id),
    client.from("findings").select("id, inspection_id, title, description, priority, status, version").eq("inspection_id", id).is("deleted_at", null),
  ]);
  if (labs.error || profiles.error || findings.error) throw new InspectionReadError();
  const lab = (labs.data as LaboratoryRow[] | null)?.[0];
  const profile = (profiles.data as ProfileRow[] | null)?.[0];
  const visibleFindings = (findings.data ?? []) as FindingRow[];
  let capturedLocation: InspectionLocation | null | undefined;
  if (row.workflow_status === "completed" && role === "coordinator") {
    const snapshot = await client.from("inspection_locations")
      .select("latitude, longitude, accuracy, captured_at").eq("inspection_id", id).maybeSingle();
    if (snapshot.error) throw new InspectionReadError();
    capturedLocation = snapshot.data?.latitude != null ? {
      latitude: snapshot.data.latitude, longitude: snapshot.data.longitude,
      accuracy: snapshot.data.accuracy, capturedAt: snapshot.data.captured_at,
    } : null;
  }
  return {
    ...(capturedLocation !== undefined ? { capturedLocation } : {}),
    coordination: coordinationFromRow(row),
    id: row.id, folio: `INS-${row.folio_number}`, folioNumber: row.folio_number, location: lab?.name ?? "Laboratorio no asignado",
    laboratoryId: row.laboratory_id, laboratoryCode: lab?.code ?? "—", inspectionDate: row.inspection_date,
    date: row.inspection_date ?? "", technician: profile?.display_name ?? "Responsable no disponible",
    workflowStatus: row.workflow_status, result: visibleFindings.length ? "requires_attention" : "without_findings",
    syncStatus: "synced", scope: row.summary, version: row.version,
    findings: visibleFindings.map(({ id: findingId, title, description, priority, status, version }) => ({ id: findingId, title, description, priority, status, version })),
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
    findings: detail.findings, syncStatus: detail.syncStatus, version: detail.version,
  };
}

async function hydrateInspectionItems(client: SupabaseClient, rows: InspectionRow[]): Promise<InspectionListItem[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const labIds = Array.from(new Set(rows.map((row) => row.laboratory_id).filter((id): id is string => !!id)));
  const profileIds = Array.from(new Set(rows.map((row) => row.inspector_id)));
  const [labs, profiles, findings] = await Promise.all([
    labIds.length ? client.from("laboratories").select("id, code, name").in("id", labIds) : Promise.resolve({ data: [], error: null }),
    client.from("profiles").select("id, display_name").in("id", profileIds),
    listVisibleFindingCounts(client, ids),
  ]);
  if (labs.error || profiles.error) throw new InspectionReadError();
  const labById = new Map(((labs.data ?? []) as LaboratoryRow[]).map((lab) => [lab.id, lab]));
  const profileById = new Map(((profiles.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const counts = new Map<string, { all: number; pending: number }>();
  for (const finding of findings) {
    const count = counts.get(finding.inspection_id) ?? { all: 0, pending: 0 };
    count.all += 1;
    if (finding.status !== "resolved") count.pending += 1;
    counts.set(finding.inspection_id, count);
  }
  return rows.map((row) => {
    const lab = row.laboratory_id ? labById.get(row.laboratory_id) : undefined;
    const { all: findingCount, pending: pendingFindingCount } = counts.get(row.id) ?? { all: 0, pending: 0 };
    return {
      coordination: coordinationFromRow(row), folio: `INS-${row.folio_number}`,
      id: row.id, location: lab?.name ?? "Laboratorio no asignado", laboratoryCode: lab?.code ?? "—",
      date: row.inspection_date ?? "", inspector: profileById.get(row.inspector_id)?.display_name ?? "Responsable no disponible",
      result: findingCount ? "requires_attention" : "without_findings", findingCount, pendingFindingCount, syncStatus: "synced",
      workflowStatus: row.workflow_status, summary: row.summary,
    };
  });
}

async function listVisibleFindingCounts(client: SupabaseClient, inspectionIds: string[]): Promise<Pick<FindingRow, "id" | "inspection_id" | "status">[]> {
  const rows: Pick<FindingRow, "id" | "inspection_id" | "status">[] = [];
  let afterId: string | null = null;
  while (true) {
    let query = client.from("findings").select("id, inspection_id, status")
      .in("inspection_id", inspectionIds).is("deleted_at", null);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query.order("id").limit(1000);
    if (error) throw new InspectionReadError();
    const page = (data ?? []) as Pick<FindingRow, "id" | "inspection_id" | "status">[];
    rows.push(...page);
    if (page.length < 1000) return rows;
    afterId = page[page.length - 1].id;
  }
}

export async function listVisibleInspections(client: SupabaseClient): Promise<InspectionListItem[]> {
  const { data, error } = await client.from("inspections")
    .select("id, folio_number, laboratory_id, inspector_id, inspection_date, summary, workflow_status, version, review_status, review_notes, reviewed_at, reviewed_by, archived_at, archived_by")
    .is("deleted_at", null).is("archived_at", null).order("created_at", { ascending: false }).limit(100);
  if (error) throw new InspectionReadError();
  return hydrateInspectionItems(client, (data ?? []) as InspectionRow[]);
}

export async function listVisibleInspectionsPage(client: SupabaseClient, query: InspectionListQuery): Promise<InspectionListPage> {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  let builder = client.from("inspections")
    .select("id, folio_number, laboratory_id, inspector_id, inspection_date, summary, workflow_status, version, review_status, review_notes, reviewed_at, reviewed_by, archived_at, archived_by")
    .is("deleted_at", null);
  builder = query.archived ? builder.not("archived_at", "is", null) : builder.is("archived_at", null);
  if (query.status) builder = builder.eq("workflow_status", query.status);
  if (query.inspectorId) builder = builder.eq("inspector_id", query.inspectorId);
  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[\\%_]/g, (match) => `\\${match}`);
    builder = builder.ilike("summary", `%${escaped}%`);
  }
  if (query.cursor) {
    const { d, i } = parseInspectionCursor(query.cursor);
    builder = d === null
      ? builder.or(`and(inspection_date.is.null,id.lt.${i})`)
      : builder.or(`inspection_date.lt."${d}",and(inspection_date.eq."${d}",id.lt.${i}),inspection_date.is.null`);
  }
  builder = builder.order("inspection_date", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(limit + 1);
  const { data, error } = await builder;
  if (error) throw new InspectionReadError();
  const rows = (data ?? []) as InspectionRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = await hydrateInspectionItems(client, page);
  const nextCursor = hasMore && page.length > 0
    ? encodeInspectionCursor({ d: page[page.length - 1].inspection_date, i: page[page.length - 1].id })
    : null;
  return { items, nextCursor };
}

/** Reads the complete visible universe in stable pages for operational totals. */
export async function listOperationalInspections(client: SupabaseClient, scope: { role: "technician" | "coordinator"; userId: string; archived?: boolean }): Promise<InspectionListItem[]> {
  const items: InspectionListItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await listVisibleInspectionsPage(client, {
      limit: 100,
      archived: scope.archived,
      cursor,
      status: scope.role === "coordinator" ? "completed" : undefined,
      inspectorId: scope.role === "technician" ? scope.userId : undefined,
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

function coordinationFromRow(row: InspectionRow) {
  return { reviewStatus: row.review_status ?? "pending", reviewNotes: row.review_notes ?? "",
    reviewedAt: row.reviewed_at ?? null, reviewedBy: row.reviewed_by ?? null,
    archivedAt: row.archived_at ?? null, archivedBy: row.archived_by ?? null };
}
