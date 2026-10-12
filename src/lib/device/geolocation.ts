import type { CapabilityResult, DeviceLocation, GeolocationClient, GeolocationDependencies } from "./contracts.ts";

/** Pure port: browser APIs are supplied by the voluntary client action. */
export function createGeolocationClient(dependencies: GeolocationDependencies): GeolocationClient {
  return {
    async locate(options) {
      const failure = (status: "denied" | "unsupported" | "error", code: "permission-denied" | "api-unavailable" | "insecure-context" | "timeout" | "position-unavailable"): CapabilityResult<DeviceLocation, "manual-laboratory"> =>
        ({ status, code, fallback: "manual-laboratory" });
      try {
        if (!dependencies.isSecureContext()) return failure("unsupported", "insecure-context");
        if (!dependencies.geolocation) return failure("unsupported", "api-unavailable");
        return await new Promise<CapabilityResult<DeviceLocation, "manual-laboratory">>((resolve) => {
          dependencies.geolocation!.getCurrentPosition(
            position => {
              const { latitude, longitude, accuracy } = position.coords;
              if (![latitude, longitude, accuracy].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0) {
                resolve(failure("error", "position-unavailable"));
                return;
              }
              try {
                resolve({ status: "success", value: { latitude, longitude, accuracy, capturedAt: dependencies.now() } });
              } catch { resolve(failure("error", "position-unavailable")); }
            },
            error => resolve(error.code === 1 ? failure("denied", "permission-denied") : failure("error", error.code === 3 ? "timeout" : "position-unavailable")),
            { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000, ...options },
          );
        });
      } catch { return failure("error", "position-unavailable"); }
    },
  };
}
