import Link from "next/link";
import { AlertTriangle, ArrowLeft, CalendarDays, ClipboardCheck, MapPin, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoadingState } from "@/components/loading-state";
import { navigationSectionsByRole } from "@/config/navigation";
import { temporarySession } from "@/config/temporary-session";
import { inspectionDetail, inspections } from "@/features/inspections";
import type { InspectionDetail } from "@/features/inspections";
import { createProfileForSession } from "@/features/profile";

type InspectionDetailPageProps = {
  params: { id: string };
  searchParams?: { estado?: string };
};

export default function InspeccionDetailPage({ params, searchParams }: InspectionDetailPageProps) {
  const { user } = temporarySession;
  const inspection = getInspectionDetail(params.id);
  const state = searchParams?.estado;

  return (
    <AppShell navigationSections={navigationSectionsByRole[user.role]} profile={createProfileForSession(user)}>
      {state === "cargando" ? <LoadingState title="Cargando detalle" description="Estamos preparando los datos de la inspección." /> : null}
      {state === "error" ? <LoadingState state="error" title="No fue posible cargar el detalle" action={<Link className={s.retryLink} href={`/inspecciones/${params.id}`}>Volver a intentar</Link>} /> : null}
      {!state && !inspection ? <LoadingState state="empty" title="No encontramos esta inspección" description="El registro solicitado no existe o ya no está disponible." action={<Link className={s.retryLink} href="/inspecciones">Ver todas las inspecciones</Link>} /> : null}
      {!state && inspection ? <InspectionDetailContent inspection={inspection} /> : null}
    </AppShell>
  );
}

function InspectionDetailContent({ inspection }: { inspection: InspectionDetail }) {
  return (
    <section aria-labelledby="inspeccion-title" className={s.page}>
      <Link className={s.backLink} href="/inspecciones"><ArrowLeft aria-hidden="true" className={s.backIcon} />Volver al listado</Link>
      <header className={s.header}>
        <div>
          <p className={s.folio}>Folio {inspection.folio}</p>
          <h1 id="inspeccion-title" className={s.title}>{inspection.location}</h1>
          <p className={s.description}>{inspection.scope}</p>
        </div>
        <span className={`${s.resultBadge} ${inspection.result === "without_findings" ? s.resultSuccess : s.resultWarning}`}>
          {inspection.result === "without_findings" ? "Sin incidencias" : "Requiere atención"}
        </span>
      </header>

      <section className={s.detailsSection} aria-labelledby="datos-title">
        <h2 id="datos-title" className={s.sectionTitle}>Datos de la inspección</h2>
        <dl className={s.detailsGrid}>
          <div className={s.detail}><dt className={s.detailLabel}><CalendarDays aria-hidden="true" className={s.detailIcon} />Fecha registrada</dt><dd className={s.detailValue}>{formatDate(inspection.date)}</dd></div>
          <div className={s.detail}><dt className={s.detailLabel}><UserRound aria-hidden="true" className={s.detailIcon} />Responsable</dt><dd className={s.detailValue}>{inspection.technician}</dd></div>
          <div className={s.detail}><dt className={s.detailLabel}><MapPin aria-hidden="true" className={s.detailIcon} />Estado</dt><dd className={s.detailValue}>{inspection.workflowStatus === "completed" ? "Finalizada" : "Borrador"}</dd></div>
        </dl>
      </section>

      <section className={s.findingsSection} aria-labelledby="hallazgos-title">
        <div className={s.sectionHeading}>
          <h2 id="hallazgos-title" className={s.sectionTitle}>Hallazgos</h2>
          <span className={s.findingCount}>{inspection.findings.length} registrado{inspection.findings.length === 1 ? "" : "s"}</span>
        </div>
        {inspection.findings.length === 0 ? (
          <div className={s.emptyFindings}><ClipboardCheck aria-hidden="true" className={s.emptyIcon} /><p>No se registraron hallazgos en esta inspección.</p></div>
        ) : (
          <ul className={s.findingsList}>
            {inspection.findings.map((finding) => <li key={finding.id} className={s.findingCard}>
              <AlertTriangle aria-hidden="true" className={s.findingIcon} />
              <div><h3 className={s.findingTitle}>{finding.title}</h3><p className={s.findingDescription}>{finding.description}</p><span className={s.priority}>Prioridad {priorityLabel[finding.priority]}</span></div>
            </li>)}
          </ul>
        )}
      </section>
    </section>
  );
}

function getInspectionDetail(id: string): InspectionDetail | undefined {
  if (id === inspectionDetail.id) return inspectionDetail;
  const listItem = inspections.find((item) => item.id === id);
  if (!listItem) return undefined;

  return {
    id: listItem.id,
    folio: listItem.id.replace("inspection-", "INS-"),
    location: listItem.location,
    date: listItem.date,
    technician: listItem.inspector,
    workflowStatus: listItem.workflowStatus,
    result: listItem.result,
    syncStatus: listItem.syncStatus,
    scope: listItem.summary,
    findings: listItem.result === "requires_attention" ? [{ id: `${listItem.id}-finding`, title: "Hallazgo pendiente de seguimiento", description: "Observación sintética registrada durante la inspección del laboratorio.", priority: "medium", status: "pending" }] : [],
  };
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`));
}

const priorityLabel = { high: "Alta", medium: "Media", low: "Baja" } as const;

const s = {
  page: "mx-auto max-w-4xl",
  backLink: "inline-flex items-center gap-1 text-sm font-medium text-secondary-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  backIcon: "size-4",
  header: "mt-5 flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between",
  folio: "font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground",
  title: "mt-2 text-3xl font-semibold tracking-tight text-foreground",
  description: "mt-3 max-w-2xl text-sm leading-6 text-muted-foreground",
  resultBadge: "h-fit rounded-sm px-2 py-1 text-xs font-medium",
  resultSuccess: "bg-emerald-100 text-emerald-800",
  resultWarning: "bg-amber-100 text-amber-900",
  detailsSection: "mt-6 rounded-lg border bg-card p-6 shadow-sm",
  sectionTitle: "text-lg font-semibold text-foreground",
  detailsGrid: "mt-4 grid gap-4 sm:grid-cols-3",
  detail: "rounded-sm bg-secondary/60 p-4",
  detailLabel: "flex items-center gap-1.5 text-xs text-muted-foreground",
  detailIcon: "size-3.5",
  detailValue: "mt-2 text-sm font-medium text-foreground",
  findingsSection: "mt-6",
  sectionHeading: "flex items-center justify-between",
  findingCount: "text-sm text-muted-foreground",
  emptyFindings: "mt-3 flex items-center gap-3 rounded-lg border border-dashed bg-card p-5 text-sm text-muted-foreground",
  emptyIcon: "size-5 shrink-0 text-emerald-700",
  findingsList: "mt-3 space-y-3",
  findingCard: "flex gap-3 rounded-lg border bg-card p-5 shadow-sm",
  findingIcon: "mt-0.5 size-5 shrink-0 text-amber-700",
  findingTitle: "font-semibold text-foreground",
  findingDescription: "mt-1 text-sm leading-6 text-muted-foreground",
  priority: "mt-3 inline-block rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground",
  retryLink: "inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
};
