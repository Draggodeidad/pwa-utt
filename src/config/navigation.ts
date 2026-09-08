import type { UserRole } from "@/features/auth";

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
