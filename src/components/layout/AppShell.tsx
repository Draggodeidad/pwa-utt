import type { ReactNode } from "react";

type AppShellProps = { children: ReactNode };

/** Shared application frame; navigation is composed by the route for the active role. */
export function AppShell({ children }: AppShellProps) {
  return <main className="page-shell">{children}</main>;
}
