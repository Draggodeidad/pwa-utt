"use client";

import { useEffect } from "react";
import { registerServiceWorker, type ServiceWorkerRegistrationCallbacks } from "@/lib/pwa/register-service-worker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    void registerServiceWorker({
      onError: error => console.error("No se pudo registrar el soporte offline.", error)
    } satisfies ServiceWorkerRegistrationCallbacks);
  }, []);

  return null;
}
