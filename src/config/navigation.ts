import type { UserRole } from "@/features/auth";
import type { AppShellNavigationSection } from "@/components/layout/AppShell";

export type NavigationItem = { label: string; href: string };

/** Declarative role navigation; route components decide how it is rendered. */
export const navigationByRole: Record<UserRole, readonly NavigationItem[]> = {
  technician: [
    { label: "Inicio", href: "/" },
    { label: "Inspecciones", href: "/inspections" },
    { label: "Nueva inspección", href: "/inspections/new" },
    { label: "Sincronización", href: "/sync" },
    { label: "Perfil", href: "/profile" }
  ],
  coordinator: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Inspecciones", href: "/inspections" },
    { label: "Hallazgos", href: "/findings" },
    { label: "Perfil", href: "/profile" }
  ]
};

/** Role-scoped navigation keeps visual groups and route authorization in one typed configuration. */
export const navigationSectionsByRole: Record<UserRole, readonly AppShellNavigationSection[]> = {
  technician: [{ label: "Mantenimiento", roleLabel: "TÉC", items: [
    { label: "Inicio", href: "/", icon: "home" }, { label: "Inspecciones", href: "/inspections", icon: "inspections" }, { label: "Nueva inspección", href: "/inspections/new", icon: "new" }, { label: "Sincronización", href: "/sync", icon: "sync" }, { label: "Perfil", href: "/profile", icon: "profile" }
  ] }],
  coordinator: [{ label: "Supervisión", roleLabel: "COORD", items: [
    { label: "Resumen", href: "/dashboard", icon: "summary" }, { label: "Inspecciones", href: "/inspections", icon: "inspections" }, { label: "Hallazgos", href: "/findings", icon: "findings" }, { label: "Perfil", href: "/profile", icon: "profile" }
  ] }]
};

export function isRouteAllowedForRole(role: UserRole, pathname: string) {
  return navigationByRole[role].some((item) => item.href === pathname);
}
