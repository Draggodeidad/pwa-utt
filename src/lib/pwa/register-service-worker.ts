export interface ServiceWorkerRegistrationCallbacks {
  onRegistered?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
  onControllerChange?: () => void;
}

export async function registerServiceWorker(
  callbacks: ServiceWorkerRegistrationCallbacks = {}
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    callbacks.onRegistered?.(registration);
    observeRegistration(registration, callbacks);
    return registration;
  } catch (reason) {
    callbacks.onError?.(toError(reason));
    return null;
  }
}

export function activateServiceWorkerUpdate(registration: ServiceWorkerRegistration): boolean {
  if (!registration.waiting) return false;

  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

function observeRegistration(registration: ServiceWorkerRegistration, callbacks: ServiceWorkerRegistrationCallbacks) {
  let updateReported = false;
  const reportUpdate = () => {
    if (updateReported || !registration.waiting) return;
    updateReported = true;
    callbacks.onUpdateAvailable?.(registration);
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => callbacks.onControllerChange?.(), { once: true });
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener("statechange", () => {
      if (installing.state === "installed") reportUpdate();
    });
  });
  reportUpdate();
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;

  const error = new Error("No se pudo registrar el service worker.");
  error.cause = reason;
  return error;
}
