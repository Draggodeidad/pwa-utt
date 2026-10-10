/** W06 ports only. Browser adapters are implemented separately in #69/#70. */
export type CapabilityFallback = "file-picker" | "manual-laboratory" | "in-app";
export type CapabilityFailureCode =
  | "permission-denied" | "api-unavailable" | "insecure-context"
  | "no-device" | "timeout" | "position-unavailable" | "capture-failed"
  | "notification-failed" | "permission-default";

export type CapabilityResult<T, F extends CapabilityFallback> =
  | { status: "success"; value: T }
  | { status: "denied" | "unsupported" | "error"; code: CapabilityFailureCode; fallback: F };

export type CameraResult<T> = CapabilityResult<T, "file-picker"> | {
  status: "cancelled";
  fallback: "file-picker";
};

/** Inject browser APIs at the client boundary; never resolve globals at import. */
export interface CameraDependencies {
  isSecureContext: () => boolean;
  mediaDevices: Pick<MediaDevices, "getUserMedia"> | null;
  /** Client frame encoder (e.g. canvas); tests inject synthetic image bytes. */
  captureFrame: (stream: MediaStream) => Promise<Blob>;
  objectUrls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  now: () => number;
}

/** stop() is idempotent and releases all tracks, including on unmount/cancel. */
export interface CameraSession {
  stream: MediaStream;
  capture(): Promise<CameraResult<Blob>>;
  stop(): void;
}

export interface CameraClient {
  /** Explicit user action only; getUserMedia must always use audio: false. */
  open(): Promise<CameraResult<CameraSession>>;
}

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
};

export interface GeolocationDependencies {
  isSecureContext: () => boolean;
  geolocation: Pick<Geolocation, "getCurrentPosition"> | null;
  now: () => number;
}

export interface GeolocationClient {
  /** One voluntary request; no watchPosition. Persistence belongs to finalization. */
  locate(options?: PositionOptions): Promise<CapabilityResult<DeviceLocation, "manual-laboratory">>;
}
