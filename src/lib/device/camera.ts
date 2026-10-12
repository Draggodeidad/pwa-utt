import type { CameraClient, CameraDependencies, CameraResult, CameraSession } from "./contracts.ts";

function cameraFailure(error: unknown): CameraResult<never> {
  const name = error instanceof Error ? error.name : "";
  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name)) {
    return { status: "denied", code: "permission-denied", fallback: "file-picker" };
  }
  return { status: "error", code: ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(name) ? "no-device" : "capture-failed", fallback: "file-picker" };
}

/** No globals at import: permissions are requested only by an explicit open(). */
export function createCameraClient(dependencies: CameraDependencies): CameraClient {
  return {
    async open(): Promise<CameraResult<CameraSession>> {
      if (!dependencies.mediaDevices) return { status: "unsupported", code: "api-unavailable", fallback: "file-picker" };
      if (!dependencies.isSecureContext()) return { status: "unsupported", code: "insecure-context", fallback: "file-picker" };
      try {
        const stream = await dependencies.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        let stopped = false;
        const stop = () => {
          if (stopped) return;
          stopped = true;
          for (const track of stream.getTracks()) track.stop();
        };
        return { status: "success", value: {
          stream, stop,
          async capture() {
            if (stopped) return { status: "cancelled", fallback: "file-picker" };
            try {
              const image = await dependencies.captureFrame(stream);
              if (stopped) return { status: "cancelled", fallback: "file-picker" };
              if (!image.size) return { status: "error", code: "capture-failed", fallback: "file-picker" };
              return { status: "success", value: image };
            } catch (error) { return cameraFailure(error); }
            finally { stop(); }
          },
        } };
      } catch (error) { return cameraFailure(error); }
    },
  };
}
