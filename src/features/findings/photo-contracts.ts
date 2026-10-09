/** User extension for #69; not a persistence implementation or a schema change. */
export const PHOTO_LIMITS = {
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxBytes: 5 * 1024 * 1024,
  maxPerFinding: 3,
} as const;

export type PhotoMimeType = typeof PHOTO_LIMITS.mimeTypes[number];
export type PhotoStatus = "local" | "pending" | "uploaded" | "error";
export type PhotoFailureCode =
  | "empty-file" | "invalid-format" | "too-large" | "too-many"
  | "forbidden" | "quota" | "write-failed" | "upload-failed" | "metadata-failed";

export type FindingPhoto = {
  id: string;
  ownerUserId: string;
  inspectionId: string;
  findingId: string;
  mimeType: PhotoMimeType;
  bytes: number;
  /** Stable private bucket/path, never a signed URL. Null until assigned. */
  object: { bucket: string; path: string } | null;
  status: PhotoStatus;
  createdAt: string;
  lastError: PhotoFailureCode | null;
};

export type PhotoResult<T> =
  | { status: "success"; value: T }
  | { status: "error"; code: PhotoFailureCode };

/** Enforce authorization in adapters/server, not from caller-provided ownership. */
export interface FindingPhotoRepository {
  list(findingId: string): Promise<PhotoResult<readonly FindingPhoto[]>>;
  attach(input: {
    photoId: string;
    inspectionId: string;
    findingId: string;
    file: Blob;
  }): Promise<PhotoResult<FindingPhoto>>;
  discard(photoId: string): Promise<PhotoResult<void>>;
  /** Resolves only after upload AND metadata ACK; retries preserve photo identity. */
  sync(photoId: string): Promise<PhotoResult<FindingPhoto>>;
  read(photoId: string): Promise<PhotoResult<Blob>>;
}
