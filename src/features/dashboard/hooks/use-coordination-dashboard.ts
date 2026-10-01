"use client";

import type { CoordinationDashboard, DashboardState } from "../types";

function stateForDashboard(dashboard: CoordinationDashboard | undefined): DashboardState {
  if (!dashboard) return "error";
  return dashboard.summary.inspectionCount === 0 ? "empty" : "ready";
}

export function useCoordinationDashboard(dashboard: CoordinationDashboard | undefined) {
  return { state: stateForDashboard(dashboard), retry: () => window.location.reload() };
}
