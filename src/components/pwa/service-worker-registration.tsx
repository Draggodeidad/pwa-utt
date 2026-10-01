"use client";

import { useEffect, useState } from "react";
import { activateServiceWorkerUpdate, registerServiceWorker, type ServiceWorkerRegistrationCallbacks } from "@/lib/pwa/register-service-worker";
import { cancelPwaUpdatePreparation, preparePwaUpdate } from "@/lib/pwa/update-coordination";

export function ServiceWorkerRegistration() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let reloadRequested = false;
    let prepared = false;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "CANCEL_PWA_UPDATE") {
        cancelPwaUpdatePreparation();
        prepared = false;
        setPreparing(false);
        return;
      }
      if (event.data?.type !== "PREPARE_PWA_UPDATE") return;
      const reply = event.ports[0];
      if (!reply) return;
      setPreparing(true);
      void preparePwaUpdate().then(() => {
        prepared = true;
        reply.postMessage({ ready: true });
      }).catch((failure: unknown) => {
        reply.postMessage({ ready: false, reason: failure instanceof Error ? failure.message : "No se pudo guardar la captura local." });
        setPreparing(false);
      });
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    void registerServiceWorker({
      onError: error => console.error("No se pudo registrar el soporte offline.", error),
      onUpdateAvailable: setRegistration,
      onControllerChange: () => {
        if (prepared && !reloadRequested) {
          reloadRequested = true;
          window.location.reload();
        }
      },
    } satisfies ServiceWorkerRegistrationCallbacks);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, []);

  const confirm = () => {
    if (!registration?.waiting || preparing) return;
    setError(null);
    setPreparing(true);
    void activateServiceWorkerUpdate(registration).then((result) => {
      if (!result.ready) {
        setError(result.reason ?? "No se pudo preparar la actualización.");
        setPreparing(false);
      }
    });
  };

  if (!registration) return null;
  return <aside className={s.prompt} role="status" aria-live="polite" aria-label="Actualización disponible">
    <p className={s.title}>Hay una nueva versión disponible</p>
    <p className={s.description}>{preparing ? "Guardando cambios y esperando a las otras pestañas…" : "Puedes instalarla ahora o seguir trabajando y hacerlo después."}</p>
    {error ? <p className={s.error} role="alert">{error}</p> : null}
    <div className={s.actions}>
      <button className={s.confirm} type="button" onClick={confirm} disabled={preparing}>Actualizar ahora</button>
      <button className={s.postpone} type="button" onClick={() => setRegistration(null)} disabled={preparing}>Posponer</button>
    </div>
  </aside>;
}

const s = {
  prompt: "fixed bottom-4 left-4 right-4 z-50 max-w-md rounded-sm border border-border bg-card p-4 text-card-foreground shadow-lg sm:left-auto",
  title: "font-semibold",
  description: "mt-1 text-sm text-muted-foreground",
  error: "mt-2 text-sm text-destructive",
  actions: "mt-3 flex gap-2",
  confirm: "rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50",
  postpone: "rounded-sm border border-input px-3 py-2 text-sm disabled:opacity-50",
};
