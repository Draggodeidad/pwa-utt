"use client";

import {
  CheckCircle2,
  CircleAlert,
  Cloud,
  CloudOff,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSyncWorkspace } from "../hooks/use-sync-workspace";
import type { SyncQueueRecord } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
});

function SyncQueueItem({
  record,
  onRetry,
}: {
  record: SyncQueueRecord;
  onRetry: (id: string) => void;
}) {
  const isError = record.status === "error";
  const isSyncing = record.status === "syncing";
  const StatusIcon = isError ? CircleAlert : isSyncing ? RefreshCw : FileText;

  return (
    <article className={isError ? s.queueItemError : s.queueItem}>
      <div className={isError ? s.recordIconError : isSyncing ? s.recordIconSyncing : s.recordIcon}>
        <StatusIcon className={isSyncing ? s.recordIconSpinning : s.recordIconGlyph} aria-hidden="true" />
      </div>
      <div className={s.recordDetails}>
        <p className={isError ? s.recordTitleError : s.recordTitle}>
          <span className={s.folio}>#{record.folio}</span>
          <span aria-hidden="true"> · </span>
          {record.laboratory}
        </p>
        <time className={s.recordDate} dateTime={record.date}>
          {dateFormatter.format(new Date(`${record.date}T12:00:00`))}
        </time>
      </div>
      <div className={s.recordActions}>
        <Badge className={isError ? s.statusError : isSyncing ? s.statusSyncing : s.statusPending}>
          {isError ? "Error" : isSyncing ? "Sincronizando" : "Pendiente"}
        </Badge>
        {isError ? (
          <Button className={s.retryButton} type="button" variant="ghost" onClick={() => onRetry(record.id)}>
            <RefreshCw className={s.retryIcon} aria-hidden="true" />
            Reintentar
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function SyncWorkspace() {
  const { state, queue, lastSyncAt, progress, retry, syncNow } = useSyncWorkspace();
  const isOffline = state === "offline";
  const isSyncing = state === "syncing";
  const completedCount = Math.min(queue.length, Math.max(1, Math.ceil((queue.length * progress) / 100)));
  const lastSyncLabel = `${timeFormatter.format(new Date(lastSyncAt))} hrs`;

  return (
    <section className={s.page} aria-labelledby="sync-title">
      <header className={s.header}>
        <h1 id="sync-title" className={s.title}>Sincronización</h1>
        <p className={s.subtitle}>Gestión de inspecciones guardadas localmente en este dispositivo.</p>
      </header>

      <div className={s.content} aria-live="polite">
        <Card className={s.summaryCard}>
          {state === "loading" ? (
            <div className={s.summarySkeleton} aria-label="Cargando estado de sincronización">
              <div className={s.skeletonLineShort} />
              <div className={s.skeletonLine} />
              <div className={s.skeletonLineMedium} />
            </div>
          ) : (
            <>
              <div className={s.summaryMeta}>
                <Badge className={isOffline ? s.connectionOffline : s.connectionOnline}>
                  {isOffline ? <CloudOff className={s.connectionIcon} aria-hidden="true" /> : <Cloud className={s.connectionIcon} aria-hidden="true" />}
                  {isOffline ? "Sin conexión" : "En línea"}
                </Badge>
                <p className={s.lastSync}>Última sincronización: {lastSyncLabel}</p>
              </div>
              <div className={s.summaryContent}>
                <div>
                  <h2 className={s.pendingCount}>{queue.length} inspecciones pendientes de envío</h2>
                  <p className={s.summaryDescription}>Los datos registrados se sincronizan con la base central del campus.</p>
                </div>
                <Button type="button" className={s.syncButton} disabled={isOffline || isSyncing || queue.length === 0} onClick={syncNow}>
                  <Cloud className={s.syncIcon} aria-hidden="true" />
                  Sincronizar ahora
                </Button>
              </div>
              {isSyncing ? (
                <div className={s.progressArea}>
                  <div className={s.progressHeader}>
                    <p className={s.progressLabel}><RefreshCw className={s.progressIcon} aria-hidden="true" />Sincronizando {completedCount} de {queue.length}...</p>
                    <span className={s.progressValue}>{progress}%</span>
                  </div>
                  <div className={s.progressTrack} aria-label="Progreso de sincronización" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} role="progressbar">
                    <div className={s.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : null}
              {state === "success" ? <p className={s.successNotice}><CheckCircle2 className={s.noticeIcon} aria-hidden="true" />Las inspecciones se sincronizaron correctamente.</p> : null}
              {isOffline ? <p className={s.offlineNotice}><CloudOff className={s.noticeIcon} aria-hidden="true" />Conéctate a una red para enviar las inspecciones pendientes.</p> : null}
            </>
          )}
        </Card>

        <Card className={s.queueCard}>
          <h2 className={s.queueTitle}>Inspecciones por enviar ({queue.length})</h2>
          {state === "loading" ? (
            <div className={s.queueSkeletons} aria-label="Cargando inspecciones pendientes">
              <div className={s.queueSkeleton} />
              <div className={s.queueSkeleton} />
              <div className={s.queueSkeleton} />
            </div>
          ) : queue.length === 0 ? (
            <p className={s.emptyState}>No hay inspecciones pendientes de sincronización.</p>
          ) : (
            <div className={s.queueList}>
              {queue.map((record) => <SyncQueueItem key={record.id} record={record} onRetry={retry} />)}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

const s = {
  page: "mx-auto max-w-[896px]",
  header: "space-y-1",
  title: "text-[32px] font-semibold tracking-tight",
  subtitle: "text-sm text-secondary-foreground",
  content: "mt-8 space-y-6",
  summaryCard: "space-y-3 border-border/80 p-6 shadow-sm",
  summarySkeleton: "space-y-4",
  skeletonLineShort: "h-5 w-28 animate-pulse rounded-sm bg-secondary",
  skeletonLine: "h-8 w-2/3 animate-pulse rounded-sm bg-secondary",
  skeletonLineMedium: "h-11 w-full animate-pulse rounded-sm bg-secondary",
  summaryMeta: "flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between",
  connectionOnline: "w-fit gap-1.5 rounded-xl border-0 bg-[#cfe4db] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[.05em] text-[#53675f]",
  connectionOffline: "w-fit gap-1.5 rounded-xl border-0 bg-destructive/15 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[.05em] text-destructive",
  connectionIcon: "size-3",
  lastSync: "font-mono text-[11px] tracking-[.05em] text-secondary-foreground",
  summaryContent: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
  pendingCount: "text-2xl font-semibold tracking-tight",
  summaryDescription: "mt-1 text-[13px] text-secondary-foreground",
  syncButton: "w-full rounded-sm px-6 font-mono text-xs tracking-[.025em] sm:w-auto",
  syncIcon: "mr-1.5 size-4",
  progressArea: "space-y-1 rounded-sm bg-secondary p-3",
  progressHeader: "flex items-center justify-between gap-3",
  progressLabel: "flex items-center gap-1 font-mono text-xs font-medium tracking-[.04em]",
  progressIcon: "size-3.5 animate-spin",
  progressValue: "font-mono text-xs text-muted-foreground",
  progressTrack: "h-2 overflow-hidden rounded-sm bg-border",
  progressFill: "h-full rounded-sm bg-[#4f625b] transition-[width] duration-200",
  successNotice: "flex items-center gap-2 rounded-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-900",
  offlineNotice: "flex items-center gap-2 rounded-sm bg-secondary px-3 py-2 text-sm text-secondary-foreground",
  noticeIcon: "size-4 shrink-0",
  queueCard: "space-y-3 border-border/80 p-6 shadow-sm",
  queueTitle: "text-base font-semibold",
  queueSkeletons: "space-y-2",
  queueSkeleton: "h-[60px] animate-pulse rounded-sm bg-secondary",
  emptyState: "rounded-sm bg-secondary p-6 text-center text-sm text-muted-foreground",
  queueList: "space-y-2",
  queueItem: "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-sm bg-secondary p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]",
  queueItemError: "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-sm bg-destructive/10 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]",
  recordIcon: "grid size-9 place-items-center rounded-sm bg-border text-secondary-foreground",
  recordIconError: "grid size-9 place-items-center rounded-sm bg-destructive/15 text-destructive",
  recordIconSyncing: "grid size-9 place-items-center rounded-sm bg-[#cfe4db] text-[#53675f]",
  recordIconGlyph: "size-4",
  recordIconSpinning: "size-4 animate-spin",
  recordDetails: "min-w-0",
  recordTitle: "truncate text-sm font-medium",
  recordTitleError: "truncate text-sm font-medium text-destructive",
  folio: "font-mono text-xs font-semibold tracking-[.025em]",
  recordDate: "mt-0.5 block text-[13px] text-secondary-foreground",
  recordActions: "col-span-2 flex items-center justify-end gap-2 sm:col-span-1",
  statusPending: "rounded-sm border-0 bg-border px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-secondary-foreground",
  statusSyncing: "rounded-sm border-0 bg-[#cfe4db] px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-[#53675f]",
  statusError: "rounded-sm border-0 bg-destructive px-2 py-0.5 font-mono text-[11px] font-medium tracking-[.05em] text-destructive-foreground",
  retryButton: "h-auto rounded-sm px-2 py-1 font-mono text-xs text-destructive hover:bg-destructive/10 hover:text-destructive",
  retryIcon: "mr-1 size-3",
};
