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
    return <main className="mx-auto w-full max-w-7xl px-6 py-10 max-sm:px-4 max-sm:py-5">{children}</main>;
  }

  const sections = navigationSections ?? [{ label: "Navegación", roleLabel: "", items: navigationItems?.map((item) => ({ ...item, icon: "home" as const })) ?? [] }];

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col border-b bg-card lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <span className="grid size-7 place-items-center rounded-sm bg-primary text-primary-foreground" aria-hidden="true"><ClipboardCheck className="size-4" /></span>
          <span className="flex-1"><span className="block text-sm font-semibold leading-none tracking-tight">Inspecciones</span><span className="mt-1 block font-mono text-[10px] tracking-[.14em] text-muted-foreground">LABORATORIO U.</span></span><button type="button" aria-label="Mostrar navegación" aria-expanded={isNavigationOpen} onClick={() => setIsNavigationOpen((open) => !open)} className="rounded-sm p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"><PanelLeft className="size-4" aria-hidden="true" /></button>
        </div>
        <nav aria-label="Navegación principal" className={`${isNavigationOpen ? "block" : "hidden"} lg:block min-h-0 flex-1 overflow-x-auto px-4 py-4`}>
          {sections.map((section, index) => <section key={section.label} className={index ? "mt-4 border-t pt-3" : ""} aria-label={section.label}>
            <div className="flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>{section.label}</span><span>{section.roleLabel}</span></div>
            <ul className="mt-1 space-y-0.5">{section.items.map((item) => {
              const Icon = navigationIcons[item.icon]; const isActive = item.href === activePath;
              return <li key={`${section.label}-${item.href}-${item.label}`}><Link href={item.href} aria-current={isActive ? "page" : undefined} className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"}`}><Icon className="size-4" aria-hidden="true" />{item.label}</Link></li>;
            })}</ul>
          </section>)}
        </nav>
        <div className={`${isNavigationOpen ? "block" : "hidden"} lg:block border-t bg-secondary/40 px-4 py-3`}><div className="flex items-center justify-between rounded-sm border bg-card px-2 py-1.5 font-mono text-[10px] text-foreground"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />En línea / Sincronizado</span><Cloud className="size-3.5" aria-hidden="true" /></div><p className="mt-2 px-1 font-mono text-[10px] tracking-wide text-muted-foreground">DB-LOCAL OK</p></div>
      </aside>
      <main className="min-w-0"><header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-8"><p className="font-mono text-[11px] text-muted-foreground"><span className="rounded-sm bg-secondary px-1.5 py-1 text-foreground">LAB-COMP-01</span> <span className="mx-1">/</span> Libreta de Auditorías de Campus</p><button type="button" aria-label="Abrir perfil" className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><UserRound className="size-4" aria-hidden="true" /></button></header><div className="px-4 py-8 sm:px-8 lg:px-8">{children}</div></main>
    </div>
  );
}
