import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, MapPin, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/loading-state";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { inspections } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";

type InspectionsPageProps = {
  searchParams?: { estado?: string };
};

export default function InspeccionesPage({ searchParams }: InspectionsPageProps) {
  const { user } = temporarySession;
  const state = searchParams?.estado;

  return (
    <AppShell navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      <section aria-labelledby="inspecciones-title" className={s.page}>
        <header className={s.header}>
          <div>
            <p className={s.eyebrow}>Semana 04</p>
            <h1 id="inspecciones-title" className={s.title}>Inspecciones</h1>
            <p className={s.description}>Consulta los registros sintéticos de los laboratorios y revisa su información detallada.</p>
          </div>
          <p className={s.count} aria-label={`${inspections.length} inspecciones registradas`}><ClipboardList aria-hidden="true" className={s.countIcon} />{inspections.length} registradas</p>
        </header>

        {state === "cargando" ? <LoadingState /> : null}
        {state === "error" ? (
          <LoadingState
            state="error"
            action={<Link className={s.retryLink} href="/inspecciones">Volver a intentar</Link>}
          />
        ) : null}
        {state === "vacio" || inspections.length === 0 ? <LoadingState state="empty" /> : null}
        {!state && inspections.length > 0 ? (
          <ul className={s.list} aria-label="Listado de inspecciones">
            {inspections.map((inspection) => (
              <li key={inspection.id}>
                <Link className={s.card} href={`/inspecciones/${inspection.id}`}>
                  <div className={s.cardMain}>
                    <div className={s.cardHeading}>
                      <span className={`${s.resultBadge} ${inspection.result === "without_findings" ? s.resultSuccess : s.resultWarning}`}>
                        {inspection.result === "without_findings" ? "Sin incidencias" : "Requiere atención"}
                      </span>
                      <span className={s.code}>{inspection.laboratoryCode}</span>
                    </div>
                    <h2 className={s.cardTitle}>{inspection.location}</h2>
                    <p className={s.summary}>{inspection.summary}</p>
                    <dl className={s.metadata}>
                      <div className={s.metadataItem}><dt className={s.metadataLabel}><CalendarDays aria-hidden="true" className={s.metadataIcon} />Fecha</dt><dd>{formatDate(inspection.date)}</dd></div>
                      <div className={s.metadataItem}><dt className={s.metadataLabel}><UserRound aria-hidden="true" className={s.metadataIcon} />Responsable</dt><dd>{inspection.inspector}</dd></div>
                      <div className={s.metadataItem}><dt className={s.metadataLabel}><MapPin aria-hidden="true" className={s.metadataIcon} />Hallazgos</dt><dd>{inspection.findingCount === 0 ? "Sin hallazgos" : `${inspection.findingCount} pendientes`}</dd></div>
                    </dl>
                  </div>
                  <ChevronRight aria-hidden="true" className={s.cardArrow} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </AppShell>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`));
}

const s = {
  page: "mx-auto max-w-5xl",
  header: "flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between",
  eyebrow: "font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground",
  title: "mt-2 text-3xl font-semibold tracking-tight text-foreground",
  description: "mt-2 max-w-2xl text-sm leading-6 text-muted-foreground",
  count: "inline-flex shrink-0 items-center gap-2 rounded-sm bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground",
  countIcon: "size-4",
  list: "mt-6 space-y-3",
  card: "group flex items-start gap-4 rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  cardMain: "min-w-0 flex-1",
  cardHeading: "flex flex-wrap items-center gap-2",
  resultBadge: "rounded-sm px-2 py-1 text-xs font-medium",
  resultSuccess: "bg-emerald-100 text-emerald-800",
  resultWarning: "bg-amber-100 text-amber-900",
  code: "font-mono text-xs text-muted-foreground",
  cardTitle: "mt-3 text-lg font-semibold leading-tight text-foreground",
  summary: "mt-1 text-sm leading-6 text-muted-foreground",
  metadata: "mt-4 grid gap-3 border-t pt-3 text-sm text-secondary-foreground sm:grid-cols-3",
  metadataItem: "min-w-0",
  metadataLabel: "mb-1 flex items-center gap-1 text-xs text-muted-foreground",
  metadataIcon: "size-3.5",
  cardArrow: "mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5",
  retryLink: "inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
};
