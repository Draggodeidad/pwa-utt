const assert = require("node:assert/strict");
const sharp = require("sharp");
const { createCameraClient } = require("../src/lib/device/camera.ts");
const { normalizePhoto } = require("../src/lib/photos/server-validation.ts");
const { validatePhotoFile } = require("../src/lib/photos/validation.ts");

async function main() {
  let calls = 0, stopped = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const dependencies = {
    isSecureContext: () => true,
    mediaDevices: { getUserMedia: async (options) => { calls++; assert.equal(options.audio, false); return stream; } },
    captureFrame: async () => new Blob(["synthetic"], { type: "image/jpeg" }),
    objectUrls: {}, now: () => 0,
  };
  const camera = createCameraClient(dependencies);
  assert.equal(calls, 0, "construction must not prompt");
  const opened = await camera.open();
  assert.equal(opened.status, "success");
  assert.equal((await opened.value.capture()).status, "success");
  opened.value.stop(); assert.equal(stopped, 1);
  assert.equal((await opened.value.capture()).status, "cancelled");
  assert.equal((await createCameraClient({ ...dependencies, mediaDevices: null }).open()).status, "unsupported");
  assert.equal((await createCameraClient({ ...dependencies, isSecureContext: () => false }).open()).code, "insecure-context");
  const denied = Object.assign(new Error("synthetic"), { name: "NotAllowedError" });
  assert.equal((await createCameraClient({ ...dependencies, mediaDevices: { getUserMedia: async () => { throw denied; } } }).open()).status, "denied");
  const broken = await createCameraClient({ ...dependencies, captureFrame: async () => { throw new Error("synthetic"); } }).open();
  assert.equal((await broken.value.capture()).status, "error"); assert.equal(stopped, 2);
  assert.throws(() => validatePhotoFile(new Blob([], { type: "image/jpeg" })), /empty-file/);
  assert.throws(() => validatePhotoFile(new Blob(["synthetic"], { type: "image/svg+xml" })), /invalid-format/);
  assert.throws(() => validatePhotoFile(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" })), /too-large/);
  for (const format of ["jpeg", "png", "webp"]) {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ff0000" } }).toFormat(format).toBuffer();
    const mime = `image/${format}`;
    const result = await normalizePhoto(bytes, mime);
    assert.equal(result.mimeType, mime); assert.equal(result.hash.length, 64);
    assert.equal((await sharp(result.bytes).metadata()).exif, undefined);
    await assert.rejects(normalizePhoto(bytes, format === "png" ? "image/jpeg" : "image/png"), /invalid-format/);
    await assert.rejects(normalizePhoto(bytes.subarray(0, 15), mime), /invalid-format/);
  }
  console.log("photo-validation.spec.ts: PASS (own #69 module tests)");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
