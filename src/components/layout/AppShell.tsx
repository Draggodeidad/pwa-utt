import type { ReactNode } from "react";

type AppShellProps = { children: ReactNode };

/** Shared application frame; navigation is composed by the route for the active role. */
export function AppShell({ children }: AppShellProps) {
  return <main className="mx-auto w-full max-w-7xl px-6 py-10 max-sm:px-4 max-sm:py-5">{children}</main>;
}
