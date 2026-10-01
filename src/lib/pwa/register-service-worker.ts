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

export function activateServiceWorkerUpdate(registration: ServiceWorkerRegistration): Promise<{ ready: boolean; reason?: string }> {
  if (!registration.waiting) return Promise.resolve({ ready: false, reason: "La actualización ya no está disponible." });
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      resolve({ ready: false, reason: "La actualización tardó demasiado. Vuelve a intentarlo." });
    }, 35000);
    channel.port1.onmessage = (event: MessageEvent<{ ready: boolean; reason?: string }>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data);
    };
    registration.waiting!.postMessage({ type: "PREPARE_AND_ACTIVATE" }, [channel.port2]);
  });
}

function observeRegistration(registration: ServiceWorkerRegistration, callbacks: ServiceWorkerRegistrationCallbacks) {
  let updateReported = false;
  const reportUpdate = () => {
    if (updateReported || !registration.waiting || !navigator.serviceWorker.controller) return;
    updateReported = true;
    callbacks.onUpdateAvailable?.(registration);
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => callbacks.onControllerChange?.());
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
