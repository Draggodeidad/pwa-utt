"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck2,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Cloud,
  CloudOff,
  Gauge,
  HardDrive,
  Home,
  ListChecks,
  PanelLeft,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useSyncStatus } from "@/features/sync";

export type AppShellNavigationItem = { label: string; href: string; icon: "home" | "inspections" | "new" | "sync" | "profile" | "summary" | "findings" };
export type AppShellNavigationSection = { label: string; roleLabel: string; items: readonly AppShellNavigationItem[] };
export type AppShellProfile = { displayName: string; roleLabel: string; email?: string; avatarUrl?: string };

type AppShellProps = {
  children: ReactNode;
  navigationItems?: readonly { label: string; href: string }[];
  navigationSections?: readonly AppShellNavigationSection[];
  activePath?: string;
  profile?: AppShellProfile;
};

type AppShellStateProps =
  | { state: "loading"; title?: string; description?: string; onRetry?: never }
  | { state: "empty"; title: string; description: string; onRetry?: never }
  | { state: "error"; title: string; description: string; onRetry: () => void };

const navigationIcons = { home: Home, inspections: ListChecks, new: CalendarCheck2, sync: RefreshCw, profile: UserRound, summary: Gauge, findings: AlertTriangle };

/** Shared application frame; navigation is composed by the route for the active role. */
export function AppShell({ children, navigationItems, navigationSections, activePath, profile }: AppShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const { status: syncStatus, pendingCount, errorCount, isSyncing, isOffline } = useSyncStatus();
  const initials = getInitials(profile?.displayName);

  if (!navigationItems && !navigationSections) {
    return <main className={s.standaloneContent}>{children}</main>;
  }

  const sections = navigationSections ?? [{ label: "Navegación", roleLabel: "", items: navigationItems?.map((item) => ({ ...item, icon: "home" as const })) ?? [] }];

  let syncStatusLabel = "Sincronizado";
  let SyncIcon = Cloud;
  if (isSyncing) {
    syncStatusLabel = "Sincronizando...";
    SyncIcon = RefreshCw;
  } else if (errorCount > 0) {
    syncStatusLabel = errorCount === 1 ? "1 error" : `${errorCount} errores`;
    SyncIcon = CircleAlert;
  } else if (pendingCount > 0) {
    syncStatusLabel = pendingCount === 1 ? "1 pendiente" : `${pendingCount} pendientes`;
    SyncIcon = Clock;
  } else if (syncStatus === "local") {
    syncStatusLabel = "Guardado local";
    SyncIcon = HardDrive;
  } else if (isOffline) {
    syncStatusLabel = "Sin conexión";
    SyncIcon = CloudOff;
  }

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brandHeader}>
          <span className={s.brandIcon} aria-hidden="true"><ClipboardCheck className={s.icon} /></span>
          <span className={s.brandText}><span className={s.brandTitle}>Inspecciones</span><span className={s.brandSubtitle}>LABORATORIO U.</span></span>
          <button type="button" aria-label="Mostrar navegación" aria-expanded={isNavigationOpen} onClick={() => setIsNavigationOpen((open) => !open)} className={s.navigationToggle}>
            <PanelLeft className={s.icon} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Navegación principal" className={`${isNavigationOpen ? s.visible : s.hidden} ${s.navigation}`}>
          {sections.map((section, index) => (
            <section key={section.label} className={index ? s.navigationSectionDivided : ""} aria-label={section.label}>
              <div className={s.navigationSectionHeader}>
                <span>{section.label}</span>
                <span>{section.roleLabel}</span>
              </div>
              <ul className={s.navigationList}>
                {section.items.map((item) => {
                  const Icon = navigationIcons[item.icon];
                  const isActive = item.href === activePath;
                  const isSyncItem = item.icon === "sync" || item.href === "/sync";
                  return (
                    <li key={`${section.label}-${item.href}-${item.label}`}>
                      <Link href={item.href} aria-current={isActive ? "page" : undefined} className={`${s.navigationItem} ${isActive ? s.navigationItemActive : s.navigationItemInactive}`}>
                        <Icon className={s.icon} aria-hidden="true" />
                        <span className={s.navigationLabel}>{item.label}</span>
                        {isSyncItem && (pendingCount > 0 || errorCount > 0) ? (
                          <span className={errorCount > 0 ? s.navBadgeError : s.navBadgePending}>
                            {errorCount > 0 ? "!" : pendingCount}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
        <div className={`${isNavigationOpen ? s.visible : s.hidden} ${s.connectivityPanel}`}>
          <Link href="/sync" className={s.connectivityStatus} aria-label={`Conectividad: ${isOffline ? "Sin conexión" : "En línea"}. Sincronización: ${syncStatusLabel}`}>
            <div className={s.connectivityDetails}>
              <span className={s.connectivityLabel}>
                <span className={isOffline ? s.connectivityDotOffline : s.connectivityDot} aria-hidden="true" />
                {isOffline ? "Sin conexión" : "En línea"}
              </span>
              <span className={s.syncStatusText}>{syncStatusLabel}</span>
            </div>
            <SyncIcon className={isSyncing ? s.connectivityIconSpinning : s.connectivityIcon} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <main className={s.main}>
        <header className={s.topBar}>
          <p className={s.topBarTitle}>Inspecciones de laboratorios</p>
          <Link href="/profile" aria-label="Abrir perfil" className={s.profileButton}>
            {profile ? (
              <span className={s.profileText}>
                <span className={s.profileName}>{profile.displayName}</span>
                <span className={s.profileRole}>{profile.roleLabel}</span>
              </span>
            ) : null}
            <span className={s.profileAvatar} title={profile?.email}>
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className={s.profileAvatarImage} />
              ) : (
                <>
                  <UserRound className={s.profileIcon} aria-hidden="true" />
                  {initials ? <span className={s.profileInitials}>{initials}</span> : null}
                </>
              )}
            </span>
          </Link>
        </header>
        <div className={s.content}>{children}</div>
      </main>
    </div>
  );
}

/** Accessible, deterministic feedback for route-level loading, empty and error boundaries. */
export function AppShellState({ state, title, description, onRetry }: AppShellStateProps) {
  if (state === "loading") {
    return (
      <section className={s.stateCard} aria-busy="true" aria-live="polite">
        <span className={s.stateSpinner} aria-hidden="true" />
        <h1 className={s.stateTitle}>{title ?? "Cargando inspecciones"}</h1>
        <p className={s.stateDescription}>{description ?? "Preparando el espacio de trabajo."}</p>
      </section>
    );
  }

  return (
    <section className={s.stateCard} role={state === "error" ? "alert" : "status"}>
      <h1 className={s.stateTitle}>{title}</h1>
      <p className={s.stateDescription}>{description}</p>
      {state === "error" ? <button type="button" className={s.stateAction} onClick={onRetry}>Reintentar</button> : null}
    </section>
  );
}

function getInitials(displayName?: string) {
  return displayName
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const s = {
  standaloneContent: "mx-auto w-full max-w-7xl px-6 py-10 max-sm:px-4 max-sm:py-5",
  shell: "min-h-dvh bg-background pt-[env(safe-area-inset-top)] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]",
  sidebar: "flex min-w-0 flex-col border-b bg-card lg:min-h-screen lg:border-b-0 lg:border-r",
  brandHeader: "flex items-center gap-2 border-b px-5 py-4",
  brandIcon: "grid size-7 place-items-center rounded-sm bg-primary text-primary-foreground",
  icon: "size-4",
  brandText: "flex-1",
  brandTitle: "block text-sm font-semibold leading-none tracking-tight",
  brandSubtitle: "mt-1 block font-mono text-[10px] tracking-[.14em] text-muted-foreground",
  navigationToggle: "rounded-sm p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden",
  visible: "block",
  hidden: "hidden",
  navigation: "lg:block min-h-0 flex-1 overflow-x-auto px-4 py-4",
  navigationSectionDivided: "mt-4 border-t pt-3",
  navigationSectionHeader: "flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
  navigationList: "mt-1 space-y-0.5",
  navigationItem: "flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  navigationItemActive: "bg-primary text-primary-foreground",
  navigationItemInactive: "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
  navigationLabel: "flex-1",
  navBadgePending: "ml-auto rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-secondary-foreground",
  navBadgeError: "ml-auto rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[10px] font-medium text-destructive-foreground",
  connectivityPanel: "lg:block border-t bg-secondary/40 px-4 py-3",
  connectivityStatus: "flex items-center justify-between rounded-sm border bg-card px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary/50",
  connectivityDetails: "flex flex-col text-left",
  connectivityLabel: "flex items-center gap-1.5 font-medium",
  connectivityDot: "size-2 rounded-full bg-emerald-600",
  connectivityDotOffline: "size-2 rounded-full bg-destructive",
  syncStatusText: "text-[10px] text-muted-foreground",
  connectivityIcon: "size-3.5",
  connectivityIconSpinning: "size-3.5 animate-spin",
  main: "min-w-0",
  topBar: "flex h-16 items-center justify-between border-b bg-card px-4 sm:px-8",
  topBarTitle: "text-sm font-medium text-secondary-foreground",
  profileButton: "flex items-center gap-3 rounded-sm px-2 py-1.5 text-right transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  profileText: "hidden min-w-0 sm:block",
  profileName: "block truncate text-sm font-medium leading-tight text-foreground",
  profileRole: "block truncate text-xs leading-tight text-muted-foreground",
  profileAvatar: "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-primary-foreground",
  profileAvatarImage: "absolute inset-0 size-full object-cover",
  profileIcon: "size-4",
  profileInitials: "sr-only",
  content: "px-4 py-8 sm:px-8 lg:px-8",
  stateCard: "mx-auto mt-8 max-w-xl rounded-lg border bg-card px-6 py-10 text-center shadow-sm",
  stateSpinner: "mx-auto block size-8 animate-spin rounded-full border-4 border-secondary border-t-primary motion-reduce:animate-none",
  stateTitle: "mt-4 text-xl font-semibold tracking-tight",
  stateDescription: "mt-2 text-sm text-muted-foreground",
  stateAction: "mt-5 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
};
