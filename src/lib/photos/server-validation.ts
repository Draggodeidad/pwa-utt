import sharp from "sharp";
import { createHash } from "node:crypto";
import { PHOTO_LIMITS } from "../../features/findings/photo-contracts.ts";
import { PhotoValidationError } from "./validation.ts";

/** Server-only decoder. Never import from a client component or browser port. */
export async function normalizePhoto(bytes: Buffer, declaredMime: string) {
  if (!bytes.length) throw new PhotoValidationError("empty-file");
  if (bytes.length > PHOTO_LIMITS.maxBytes) throw new PhotoValidationError("too-large");
  const mimeType = PHOTO_LIMITS.mimeTypes.find((mime) => mime === declaredMime);
  if (!mimeType) throw new PhotoValidationError("invalid-format");
  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: 25_000_000 });
    const meta = await image.metadata();
    const format = mimeType === "image/jpeg" ? "jpeg" : mimeType === "image/png" ? "png" : "webp";
    if (meta.format !== format || !meta.width || !meta.height || (meta.pages ?? 1) !== 1) throw new PhotoValidationError("invalid-format");
    // Full decode/re-encode removes metadata (including GPS), applying EXIF orientation.
    const output = await image.rotate().toFormat(format).timeout({ seconds: 5 }).toBuffer();
    if (output.length > PHOTO_LIMITS.maxBytes) throw new PhotoValidationError("too-large");
    return { bytes: output, mimeType, sourceHash: createHash("sha256").update(bytes).digest("hex"), hash: createHash("sha256").update(output).digest("hex") };
  } catch (error) {
    if (error instanceof PhotoValidationError) throw error;
    throw new PhotoValidationError("invalid-format");
  }
}
