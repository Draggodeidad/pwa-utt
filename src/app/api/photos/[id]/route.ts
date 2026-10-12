import { NextResponse, type NextRequest } from "next/server";
import { authorizeRequest } from "@/lib/auth/guards";
import { apiError, hasValidMutationOrigin, readJsonMutation, privateJson } from "@/lib/auth/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { validateDomainOperation, validateOperationId } from "@/features/sync";
import { expectUuid, DomainValidationError } from "@/types/entity";
import { PhotoValidationError } from "@/lib/photos/validation";
import { deleteFindingPhoto, readFindingPhoto, uploadFindingPhoto, PhotoRemoteError } from "@/lib/photos/remote";
import { PHOTO_LIMITS } from "@/features/findings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof DomainValidationError || error instanceof PhotoValidationError) return apiError("INVALID_REQUEST", { code: "VALIDATION_ERROR", message: error.message });
  if (error instanceof PhotoRemoteError) {
    if (error.code === "FORBIDDEN") return apiError("FORBIDDEN");
    if (error.code === "NOT_FOUND") return apiError("NOT_FOUND");
    if (["VERSION_CONFLICT", "IDEMPOTENCY_KEY_REUSED"].includes(error.code)) return apiError("CONFLICT", { code: error.code });
    if (error.code === "TOO_MANY_PHOTOS") return apiError("INVALID_REQUEST", { code: "VALIDATION_ERROR", message: "Máximo tres fotos por hallazgo" });
  }
  return apiError("UNAVAILABLE");
}
async function limitedBody(request: NextRequest): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > PHOTO_LIMITS.maxBytes) throw new PhotoValidationError("too-large");
  const reader = request.body?.getReader();
  if (!reader) throw new PhotoValidationError("empty-file");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > PHOTO_LIMITS.maxBytes) { await reader.cancel(); throw new PhotoValidationError("too-large"); }
      chunks.push(part.value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["technician"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  if (!hasValidMutationOrigin(request)) return auth.withCookies(apiError("FORBIDDEN"));
  try {
    const id = expectUuid(params.id, "photoId");
    const operationId = validateOperationId(request.headers.get("idempotency-key"));
    const header = request.headers.get("x-photo-operation") ?? "";
    if (header.length > 4096) throw new PhotoValidationError("invalid-format");
    let body: unknown; try { body = JSON.parse(header); } catch { throw new PhotoValidationError("invalid-format"); }
    const operation = validateDomainOperation(body);
    if (operation.kind !== "photo.upload" || operation.entityId !== id || operation.payload.mimeType !== request.headers.get("content-type")) throw new PhotoValidationError("invalid-format");
    const ack = await uploadFindingPhoto(auth.client, id, operationId, operation.payload, await limitedBody(request));
    return auth.withCookies(privateJson(ack, ack.replayed ? 200 : 201));
  } catch (error) { return auth.withCookies(failure(error)); }
}
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["technician"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  const parsed = await readJsonMutation(request); if (parsed.error) return auth.withCookies(parsed.error);
  try {
    const id = expectUuid(params.id, "photoId");
    const operation = validateDomainOperation(parsed.body);
    if (operation.kind !== "photo.delete" || operation.entityId !== id) throw new PhotoValidationError("invalid-format");
    const ack = await deleteFindingPhoto(auth.client, id, validateOperationId(request.headers.get("idempotency-key")), operation.payload.findingId, operation.payload.inspectionId);
    return auth.withCookies(privateJson(ack));
  } catch (error) { return auth.withCookies(failure(error)); }
}
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = createRequestSupabaseClient(request);
  const permission = await authorizeRequest(auth.client, ["technician", "coordinator"]);
  if ("error" in permission) return auth.withCookies(apiError(permission.error === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"));
  try {
    const photo = await readFindingPhoto(auth.client, expectUuid(params.id, "photoId"));
    return auth.withCookies(new NextResponse(photo.file, { headers: { "Content-Type": photo.mimeType, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } }));
  } catch (error) { return auth.withCookies(failure(error)); }
}
