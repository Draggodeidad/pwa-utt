const assert = require("node:assert/strict");
const sharp = require("sharp");
const { createHash } = require("node:crypto");
const { uploadFindingPhoto, deleteFindingPhoto } = require("../src/lib/photos/remote.ts");
const id = "11111111-1111-4111-8111-111111111169", findingId = "22222222-2222-4222-8222-222222222269", inspectionId = "33333333-3333-4333-8333-333333333369";
async function main() {
  const source = await sharp({ create: { width: 3, height: 3, channels: 3, background: "red" } }).png().toBuffer();
  const payload = { findingId, inspectionId, mimeType: "image/png", bytes: source.length, sourceHash: createHash("sha256").update(source).digest("hex") };
  const objects = new Map(); let row = null, failMetadata = true, uploads = 0, removes = 0;
  const client = {
    from: table => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "findings" ? { inspection_id: inspectionId } : row, error: null }) }) }) }),
    rpc: async (name, args) => {
      if (name === "reserve_finding_photo") {
        if (!row) row = { id, finding_id: findingId, inspection_id: inspectionId, owner_user_id: id, mime_type: args.p_mime, bytes: args.p_bytes, source_hash: args.p_source_hash, content_hash: args.p_content_hash, bucket: "finding-photos", object_path: id, state: "pending", version: 1, created_at: "2026-10-09T00:00:00Z", updated_at: "2026-10-09T00:00:00Z" };
        if (row.source_hash !== args.p_source_hash) return { data: null, error: { message: "IDEMPOTENCY_KEY_REUSED" } };
        return { data: { ...row, __replayed: row.state === "uploaded" }, error: null };
      }
      if (name === "complete_finding_photo") {
        if (failMetadata) { failMetadata = false; return { error: { message: "synthetic metadata failure" } }; }
        row.state = "uploaded"; row.version = 2; return { data: row, error: null };
      }
      if (name === "delete_finding_photo") {
        row.state = args.p_complete ? "deleted" : "deleting";
        return { data: row, error: null };
      }
      throw new Error(name);
    },
    storage: { from: () => ({
      upload: async (path, bytes, options) => { uploads++; assert.equal(options.upsert, false); if (objects.has(path)) return { error: { message: "exists" } }; objects.set(path, bytes); return { error: null }; },
      download: async path => ({ data: objects.has(path) ? new Blob([objects.get(path)]) : null, error: objects.has(path) ? null : { message: "missing" } }),
      remove: async paths => { removes++; paths.forEach(path => objects.delete(path)); return { error: null }; },
    }) },
  };
  await assert.rejects(uploadFindingPhoto(client, id, "op", payload, source), /metadata failure/);
  assert.equal(objects.size, 1); assert.equal(row.state, "pending");
  const retried = await uploadFindingPhoto(client, id, "op", payload, source);
  assert.equal(retried.photo.status, "uploaded"); assert.equal(objects.size, 1); assert.equal(uploads, 2);
  const replay = await uploadFindingPhoto(client, id, "op", payload, source);
  assert.equal(replay.replayed, true); assert.equal(uploads, 2);
  await assert.rejects(uploadFindingPhoto(client, id, "op", { ...payload, sourceHash: "0".repeat(64) }, source), /IDEMPOTENCY_KEY_REUSED/);
  await assert.rejects(uploadFindingPhoto(client, id, "op", { ...payload, inspectionId: id }, source), /NOT_FOUND/);
  const deleted = await deleteFindingPhoto(client, id, "delete-op", findingId, inspectionId);
  assert.equal(deleted.entityType, "photo"); assert.equal(objects.size, 0); assert.equal(removes, 1); assert.equal(row.state, "deleted");
  console.log("photo-remote.spec.ts: PASS (real decoder + injected Storage/RPC; live RLS pending)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
