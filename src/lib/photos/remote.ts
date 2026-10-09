import type { SupabaseClient } from "@supabase/supabase-js";
import type { FindingPhoto, PhotoUploadPayload } from "../../features/findings/photo-contracts.ts";
import type { OperationAcknowledgement } from "../../features/sync/types.ts";
import { normalizePhoto } from "./server-validation.ts";
import { createHash } from "node:crypto";

export type PhotoRow = { id: string; finding_id: string; inspection_id: string; owner_user_id: string; bucket: string; object_path: string; mime_type: FindingPhoto["mimeType"]; bytes: number; source_hash: string; content_hash: string; state: string; version: number; created_at: string; updated_at: string; __replayed?: boolean };

export class PhotoRemoteError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
function rpcRow(data: unknown, error: { message: string } | null): PhotoRow {
  if (error) throw new PhotoRemoteError(error.message);
  if (!data || typeof data !== "object" || !("id" in data) || !("object_path" in data)) throw new PhotoRemoteError("UNAVAILABLE");
  return data as PhotoRow;
}
export function photoFromRow(row: PhotoRow): FindingPhoto {
  return { id: row.id, ownerUserId: row.owner_user_id, findingId: row.finding_id, inspectionId: row.inspection_id, object: { bucket: row.bucket, path: row.object_path }, mimeType: row.mime_type, bytes: row.bytes, status: row.state === "uploaded" ? "uploaded" : "pending", createdAt: row.created_at, lastError: null };
}
export function photoAcknowledgement(row: PhotoRow, operationId: string): OperationAcknowledgement {
  return { operationId, entityId: row.id, entityType: "photo", version: row.version, appliedAt: row.updated_at, replayed: row.__replayed === true, photo: photoFromRow(row) };
}

export async function uploadFindingPhoto(client: SupabaseClient, photoId: string, operationId: string, payload: PhotoUploadPayload, bytes: Buffer) {
  const image = await normalizePhoto(bytes, payload.mimeType);
  if (image.sourceHash !== payload.sourceHash || bytes.length !== payload.bytes) throw new PhotoRemoteError("IDEMPOTENCY_KEY_REUSED");
  const finding = await client.from("findings").select("inspection_id").eq("id", payload.findingId).maybeSingle();
  if (finding.error) throw new PhotoRemoteError("UNAVAILABLE");
  if (!finding.data || finding.data.inspection_id !== payload.inspectionId) throw new PhotoRemoteError("NOT_FOUND");
  const reservation = await client.rpc("reserve_finding_photo", { p_id: photoId, p_finding_id: payload.findingId, p_mime: image.mimeType, p_bytes: image.bytes.length, p_source_hash: image.sourceHash, p_content_hash: image.hash });
  const row = rpcRow(reservation.data, reservation.error);
  if (row.inspection_id !== payload.inspectionId) throw new PhotoRemoteError("NOT_FOUND");
  if (row.state === "uploaded") return photoAcknowledgement(row, operationId);
  const bucket = client.storage.from(row.bucket);
  // Never upsert: an existing object can only be reconciled if its bytes match.
  const uploaded = await bucket.upload(row.object_path, image.bytes, { contentType: image.mimeType, upsert: false });
  if (uploaded.error) {
    const existing = await bucket.download(row.object_path);
    if (existing.error || !existing.data) throw new PhotoRemoteError("UPLOAD_FAILED");
    const hash = createHash("sha256").update(Buffer.from(await existing.data.arrayBuffer())).digest("hex");
    if (hash !== image.hash) throw new PhotoRemoteError("IDEMPOTENCY_KEY_REUSED");
  }
  const finished = await client.rpc("complete_finding_photo", { p_id: photoId });
  return photoAcknowledgement(rpcRow(finished.data, finished.error), operationId);
}

export async function deleteFindingPhoto(client: SupabaseClient, photoId: string, operationId: string, findingId: string, inspectionId: string) {
  // Association is verified before modifying state.
  const current = await client.from("finding_photos").select("*").eq("id", photoId).maybeSingle();
  // An already deleted row is hidden by RLS; the RPC validates ownership for replay.
  if (current.data && (current.data.finding_id !== findingId || current.data.inspection_id !== inspectionId)) throw new PhotoRemoteError("NOT_FOUND");
  const begun = await client.rpc("delete_finding_photo", { p_id: photoId });
  if (begun.error?.message === "NOT_FOUND" && !current.data && !current.error) {
    return { operationId, entityId: photoId, entityType: "photo" as const, version: 1, appliedAt: new Date().toISOString(), replayed: true };
  }
  const row = rpcRow(begun.data, begun.error);
  if (row.finding_id !== findingId || row.inspection_id !== inspectionId) throw new PhotoRemoteError("NOT_FOUND");
  if (row.state === "deleted") return photoAcknowledgement(row, operationId);
  const removed = await client.storage.from(row.bucket).remove([row.object_path]);
  if (removed.error) throw new PhotoRemoteError("DELETE_FAILED");
  const finished = await client.rpc("delete_finding_photo", { p_id: photoId, p_complete: true });
  return photoAcknowledgement(rpcRow(finished.data, finished.error), operationId);
}

export async function readFindingPhoto(client: SupabaseClient, id: string) {
  const result = await client.from("finding_photos").select("*").eq("id", id).eq("state", "uploaded").maybeSingle();
  if (result.error) throw new PhotoRemoteError("UNAVAILABLE");
  if (!result.data) throw new PhotoRemoteError("NOT_FOUND");
  const row = result.data as PhotoRow;
  const object = await client.storage.from(row.bucket).download(row.object_path);
  if (object.error || !object.data) throw new PhotoRemoteError("NOT_FOUND");
  return { file: object.data, mimeType: row.mime_type };
}
