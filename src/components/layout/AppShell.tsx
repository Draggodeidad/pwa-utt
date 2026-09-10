"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck2, ClipboardCheck, Cloud, Gauge, Home, ListChecks, PanelLeft, RefreshCw, UserRound } from "lucide-react";
import { useState } from "react";

export type AppShellNavigationItem = { label: string; href: string; icon: "home" | "inspections" | "new" | "sync" | "profile" | "summary" | "findings" };
export type AppShellNavigationSection = { label: string; roleLabel: string; items: readonly AppShellNavigationItem[] };

type AppShellProps = {
  children: ReactNode;
  navigationItems?: readonly { label: string; href: string }[];
  navigationSections?: readonly AppShellNavigationSection[];
  activePath?: string;
};

const navigationIcons = { home: Home, inspections: ListChecks, new: CalendarCheck2, sync: RefreshCw, profile: UserRound, summary: Gauge, findings: AlertTriangle };

/** Shared application frame; navigation is composed by the route for the active role. */
export function AppShell({ children, navigationItems, navigationSections, activePath }: AppShellProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  if (!navigationItems && !navigationSections) {
    return <main className={s.standaloneContent}>{children}</main>;
  }

  const sections = navigationSections ?? [{ label: "Navegación", roleLabel: "", items: navigationItems?.map((item) => ({ ...item, icon: "home" as const })) ?? [] }];

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brandHeader}>
          <span className={s.brandIcon} aria-hidden="true"><ClipboardCheck className={s.icon} /></span>
          <span className={s.brandText}><span className={s.brandTitle}>Inspecciones</span><span className={s.brandSubtitle}>LABORATORIO U.</span></span><button type="button" aria-label="Mostrar navegación" aria-expanded={isNavigationOpen} onClick={() => setIsNavigationOpen((open) => !open)} className={s.navigationToggle}><PanelLeft className={s.icon} aria-hidden="true" /></button>
        </div>
        <nav aria-label="Navegación principal" className={`${isNavigationOpen ? s.visible : s.hidden} ${s.navigation}`}>
          {sections.map((section, index) => <section key={section.label} className={index ? s.navigationSectionDivided : ""} aria-label={section.label}>
            <div className={s.navigationSectionHeader}><span>{section.label}</span><span>{section.roleLabel}</span></div>
            <ul className={s.navigationList}>{section.items.map((item) => {
              const Icon = navigationIcons[item.icon]; const isActive = item.href === activePath;
              return <li key={`${section.label}-${item.href}-${item.label}`}><Link href={item.href} aria-current={isActive ? "page" : undefined} className={`${s.navigationItem} ${isActive ? s.navigationItemActive : s.navigationItemInactive}`}><Icon className={s.icon} aria-hidden="true" />{item.label}</Link></li>;
            })}</ul>
          </section>)}
        </nav>
        <div className={`${isNavigationOpen ? s.visible : s.hidden} ${s.connectivityPanel}`}><div className={s.connectivityStatus}><span className={s.connectivityLabel}><span className={s.connectivityDot} aria-hidden="true" />En línea</span><Cloud className={s.connectivityIcon} aria-hidden="true" /></div></div>
      </aside>
      <main className={s.main}><header className={s.topBar}><p className={s.topBarTitle}>Inspecciones de laboratorios</p><button type="button" aria-label="Abrir perfil" className={s.profileButton}><UserRound className={s.icon} aria-hidden="true" /></button></header><div className={s.content}>{children}</div></main>
    </div>
  );
}

const s = {
  standaloneContent: "mx-auto w-full max-w-7xl px-6 py-10 max-sm:px-4 max-sm:py-5",
  shell: "min-h-screen bg-background lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]",
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
  connectivityPanel: "lg:block border-t bg-secondary/40 px-4 py-3",
  connectivityStatus: "flex items-center justify-between rounded-sm border bg-card px-2 py-1.5 text-xs text-foreground",
  connectivityLabel: "flex items-center gap-1.5",
  connectivityDot: "size-2 rounded-full bg-emerald-600",
  connectivityIcon: "size-3.5",
  main: "min-w-0",
  topBar: "flex h-16 items-center justify-between border-b bg-card px-4 sm:px-8",
  topBarTitle: "text-sm font-medium text-secondary-foreground",
  profileButton: "grid size-7 place-items-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  content: "px-4 py-8 sm:px-8 lg:px-8",
};
