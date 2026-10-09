import type { LocalStorage } from "../../../lib/pwa/offline-storage.ts";
import { photoSourceHash, validatePhotoFile, PhotoValidationError } from "../../../lib/photos/validation.ts";
import type { FindingPhoto, FindingPhotoRepository, LocalPhoto, PhotoResult } from "../photo-contracts.ts";
import { isSessionCurrent, sessionEpoch } from "../../../lib/pwa/offline-session.ts";

export async function createLocalPhoto(input: { id: string; owner: string; inspectionId: string; findingId: string; file: Blob }, now: () => number = Date.now): Promise<LocalPhoto> {
  const mimeType = validatePhotoFile(input.file);
  const sourceHash = await photoSourceHash(input.file);
  const at = new Date(now()).toISOString();
  return { id: input.id, ownerUserId: input.owner, inspectionId: input.inspectionId, findingId: input.findingId, mimeType, bytes: input.file.size, object: null, status: "pending", createdAt: at, lastError: null, sourceHash, blob: input.file, deletedAt: null, version: 0, baseVersion: null, localRevision: 1, syncStatus: "pending", localUpdatedAt: at, updatedAt: at };
}

export function createFindingPhotoRepository(dependencies: { owner: string; storage: LocalStorage; fetch: typeof fetch; now?: () => number }): FindingPhotoRepository {
  const { owner, storage, fetch: request } = dependencies;
  const epoch = sessionEpoch();
  const active = () => typeof localStorage === "undefined" || isSessionCurrent(epoch, owner);
  async function list(findingId: string): Promise<PhotoResult<readonly FindingPhoto[]>> {
    if (!active()) return { status: "error", code: "forbidden" };
    const local = await storage.listPhotos(owner, undefined, findingId);
    let remote: FindingPhoto[] = [];
    try {
      const response = await request(`/api/findings/${findingId}/photos`, { credentials: "same-origin", cache: "no-store" });
      if (!active()) return { status: "error", code: "forbidden" };
      if (response.ok) {
        remote = await response.json() as FindingPhoto[];
        await storage.cachePhotos(owner, remote);
      } else if (response.status === 401 || response.status === 403) return { status: "error", code: "forbidden" };
    } catch { /* local photos remain available offline */ }
    const byId = new Map(remote.map(photo => [photo.id, photo]));
    for (const photo of local) { if (photo.deletedAt) byId.delete(photo.id); else byId.set(photo.id, photo); }
    return { status: "success", value: Array.from(byId.values()) };
  }
  return {
    list,
    async attach(input) {
      if (!active()) return { status: "error", code: "forbidden" };
      try {
        const photo = await createLocalPhoto({ id: input.photoId, owner, inspectionId: input.inspectionId, findingId: input.findingId, file: input.file }, dependencies.now);
        await storage.saveCapture(owner, [], [], [], { add: [photo], remove: [] });
        return { status: "success", value: photo };
      } catch (error) { return { status: "error", code: error instanceof PhotoValidationError ? error.code : "write-failed" }; }
    },
    async discard(photoId) {
      if (!active()) return { status: "error", code: "forbidden" };
      try { await storage.saveCapture(owner, [], [], [], { add: [], remove: [photoId] }); return { status: "success", value: undefined }; }
      catch { return { status: "error", code: "write-failed" }; }
    },
    async sync(photoId) {
      // Transport belongs to the shared leased runner, not a second independent loop.
      const photo = await storage.getPhoto(owner, photoId);
      if (!photo || photo.status !== "uploaded") return { status: "error", code: "upload-failed" };
      return { status: "success", value: photo };
    },
    async read(photoId) {
      if (!active()) return { status: "error", code: "forbidden" };
      const local = await storage.getPhoto(owner, photoId);
      if (local?.blob && !local.deletedAt) return { status: "success", value: local.blob };
      try {
        const response = await request(`/api/photos/${photoId}`, { credentials: "same-origin", cache: "no-store" });
        if (!active()) return { status: "error", code: "forbidden" };
        if (!response.ok) return { status: "error", code: response.status === 403 || response.status === 401 ? "forbidden" : "upload-failed" };
        const blob = await response.blob();
        if (!active()) return { status: "error", code: "forbidden" };
        return { status: "success", value: blob };
      } catch { return { status: "error", code: "upload-failed" }; }
    },
  };
}
