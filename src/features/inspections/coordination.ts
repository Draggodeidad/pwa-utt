import { DomainValidationError } from "../../types/entity.ts";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type InspectionCoordination = {
  reviewStatus: ReviewStatus;
  reviewNotes: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
};
export type CoordinationAction = "approve" | "reject" | "archive" | "unarchive" | "delete";
export type CoordinationRequest = { action: CoordinationAction; baseVersion: number; notes?: string; confirmation?: string };
export type CoordinationAcknowledgement = InspectionCoordination & {
  id: string; version: number; reviewStatus: ReviewStatus; archivedAt: string | null; deletedAt: string | null; replayed: boolean;
};
export const reviewLabels: Record<ReviewStatus, string> = { pending: "Pendiente de decisión", approved: "Aprobada", rejected: "Rechazada" };
const actions: readonly string[] = ["approve", "reject", "archive", "unarchive", "delete"];

export function validateCoordinationRequest(value: unknown): CoordinationRequest {
  const invalid = (path: string, message: string): never => { throw new DomainValidationError([{ path, message }]); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("body", "Solicitud no válida");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["action", "baseVersion", "notes", "confirmation"].includes(key))) return invalid("body", "Campos no permitidos");
  if (typeof body.action !== "string" || !actions.includes(body.action)) return invalid("action", "Acción no válida");
  if (!Number.isSafeInteger(body.baseVersion) || (body.baseVersion as number) < 1 || (body.baseVersion as number) > 2147483647) return invalid("baseVersion", "Versión no válida");
  if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 2000)) return invalid("notes", "Máximo 2000 caracteres");
  if (body.action === "reject" && (typeof body.notes !== "string" || !body.notes.trim())) return invalid("notes", "Escribe el motivo del rechazo");
  if (!["approve", "reject"].includes(body.action) && body.notes !== undefined) return invalid("notes", "Esta acción no modifica notas");
  if (body.action === "delete") {
    if (typeof body.confirmation !== "string" || !/^INS-[1-9]\d{0,18}$/.test(body.confirmation)) return invalid("confirmation", "Escribe el folio exacto");
  } else if (body.confirmation !== undefined) return invalid("confirmation", "Confirmación no permitida");
  return body as CoordinationRequest;
}

/** UI eligibility mirrors the RPC; database authorization/version remain authoritative. */
export function coordinationActions(inspection: { workflowStatus: string; coordination?: InspectionCoordination }): CoordinationAction[] {
  const c = inspection.coordination;
  if (inspection.workflowStatus !== "completed" || !c) return [];
  if (c.archivedAt) return ["unarchive", "delete"];
  if (c.reviewStatus === "pending") return ["approve", "reject"];
  return c.reviewStatus === "rejected" ? ["archive", "delete"] : ["archive"];
}
