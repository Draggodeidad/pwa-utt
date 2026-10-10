import type { InspectionDetail } from "../types";

/** undefined means not authorized; null means authorized but no capture. */
export function InspectionLocation({ inspection }: { inspection: Pick<InspectionDetail, "workflowStatus" | "capturedLocation"> }) {
  if (inspection.workflowStatus !== "completed" || inspection.capturedLocation === undefined) return null;
  const location = inspection.capturedLocation;
  return (
    <section className={s.panel} aria-labelledby="inspection-location-title">
      <h2 id="inspection-location-title" className={s.title}>Ubicación de captura</h2>
      {location ? (
        <>
          <dl className={s.coordinates}>
            <div><dt>Latitud</dt><dd>{location.latitude}</dd></div>
            <div><dt>Longitud</dt><dd>{location.longitude}</dd></div>
            <div><dt>Precisión</dt><dd>± {location.accuracy} m</dd></div>
            <div><dt>Capturada</dt><dd><time dateTime={location.capturedAt}>{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(location.capturedAt))}</time></dd></div>
          </dl>
          <a className={s.mapLink} href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Ver ubicación en el mapa</a>
        </>
      ) : <p className={s.emptyState}>No se registró ubicación GPS al finalizar esta inspección.</p>}
    </section>
  );
}

const s = {
  panel: "mt-6 space-y-3 rounded-lg border bg-card p-6 shadow-sm",
  title: "text-lg font-semibold text-foreground",
  coordinates: "grid gap-3 text-sm text-foreground sm:grid-cols-2",
  mapLink: "inline-flex min-h-11 items-center text-sm font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  emptyState: "text-sm text-muted-foreground",
};
