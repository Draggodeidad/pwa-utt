import { PHOTO_LIMITS } from "../../features/findings/photo-contracts.ts";
import type { PhotoFailureCode, PhotoMimeType } from "../../features/findings/photo-contracts.ts";

export class PhotoValidationError extends Error {
  readonly code: PhotoFailureCode;
  constructor(code: PhotoFailureCode) { super(code); this.code = code; this.name = "PhotoValidationError"; }
}

export function validatePhotoFile(file: Blob): PhotoMimeType {
  if (!file.size) throw new PhotoValidationError("empty-file");
  if (file.size > PHOTO_LIMITS.maxBytes) throw new PhotoValidationError("too-large");
  const mime = PHOTO_LIMITS.mimeTypes.find((value) => value === file.type);
  if (!mime) throw new PhotoValidationError("invalid-format");
  return mime;
}

export async function photoSourceHash(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
