"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createGeolocationClient } from "@/lib/device/geolocation";
import type { DeviceLocation } from "@/lib/device/contracts";
import { isSessionCurrent, sessionEpoch } from "@/lib/pwa/offline-session";

const failureMessages: Record<string, string> = {
  "permission-denied": "Permiso denegado. Puedes seleccionar el laboratorio manualmente.",
  "api-unavailable": "Este navegador no ofrece ubicación. Selecciona el laboratorio manualmente.",
  "insecure-context": "La ubicación requiere una conexión segura. Puedes continuar sin ella.",
  timeout: "La ubicación tardó demasiado. Puedes reintentar o continuar sin ella.",
  "position-unavailable": "No se pudo obtener la ubicación. Puedes continuar sin ella.",
};

export function OptionalLocation({ owner }: { owner: string }) {
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  useEffect(() => {
    const clear = () => {
      request.current++;
      setLocation(null);
      setBusy(false);
      setMessage("");
    };
    const storageChanged = (event: StorageEvent) => {
      if (!event.key || event.key === "pwa-utt:active-session" || event.key === "pwa-utt:session-gate") clear();
    };
    window.addEventListener("pwa-utt:session-changed", clear);
    window.addEventListener("storage", storageChanged);
    return () => {
      request.current++;
      window.removeEventListener("pwa-utt:session-changed", clear);
      window.removeEventListener("storage", storageChanged);
    };
  }, [owner]);
  const locate = async () => {
    const epoch = sessionEpoch();
    if (!isSessionCurrent(epoch, owner)) {
      setMessage("Verifica tu sesión para obtener ubicación; puedes continuar sin ella.");
      return;
    }
    const id = ++request.current;
    setBusy(true);
    setMessage("Obteniendo ubicación…");
    const client = createGeolocationClient({
      isSecureContext: () => window.isSecureContext,
      geolocation: navigator.geolocation ?? null,
      now: Date.now,
    });
    const result = await client.locate();
    if (request.current !== id || !isSessionCurrent(epoch, owner)) return;
    setBusy(false);
    if (result.status === "success") {
      setLocation(result.value);
      setMessage("Ubicación obtenida. Sólo se muestra durante esta edición.");
    } else setMessage(failureMessages[result.code] ?? failureMessages["position-unavailable"]);
  };
  const clear = () => {
    request.current++;
    setLocation(null);
    setBusy(false);
    setMessage("Ubicación borrada.");
  };
  return (
    <section className={s.panel} aria-labelledby="optional-location-title">
      <h3 id="optional-location-title" className={s.title}>Ubicación opcional</h3>
      <p className={s.description}>No se guarda ni se envía. Selecciona siempre el laboratorio manualmente; puedes guardar sin ubicación.</p>
      <div className={s.actions}>
        <Button type="button" variant="outline" className={s.button} disabled={busy} onClick={() => void locate()}>
          {busy ? "Obteniendo…" : location ? "Actualizar ubicación" : "Obtener ubicación"}
        </Button>
        {location || busy ? <Button type="button" variant="ghost" className={s.button} onClick={clear}>Borrar ubicación</Button> : null}
      </div>
      {location ? (
        <dl className={s.coordinates}>
          <div><dt>Latitud</dt><dd>{location.latitude.toFixed(5)}</dd></div>
          <div><dt>Longitud</dt><dd>{location.longitude.toFixed(5)}</dd></div>
          <div><dt>Precisión</dt><dd>± {Math.round(location.accuracy)} m</dd></div>
        </dl>
      ) : null}
      <p role="status" aria-live="polite" className={s.description}>{message}</p>
    </section>
  );
}

const s = {
  panel: "min-w-0 space-y-3 rounded-lg border border-border bg-muted/30 p-4",
  title: "text-sm font-semibold text-foreground",
  description: "text-sm text-muted-foreground",
  actions: "flex flex-wrap gap-2",
  button: "min-h-11 whitespace-normal",
  coordinates: "grid grid-cols-1 gap-2 text-sm text-foreground sm:grid-cols-3",
};
