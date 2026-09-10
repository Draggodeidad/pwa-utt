"use client";

import { useEffect, useState } from "react";
import type { CoordinationDashboard, DashboardState } from "../types";

function stateForDashboard(dashboard: CoordinationDashboard | undefined): DashboardState {
  if (!dashboard) return "error";
  return dashboard.summary.inspectionCount === 0 ? "empty" : "ready";
}

/** Lightweight client loading boundary until the coordination repository is available. */
export function useCoordinationDashboard(dashboard: CoordinationDashboard | undefined) {
  const [state, setState] = useState<DashboardState>("loading");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setState(stateForDashboard(dashboard)), 250);
    return () => window.clearTimeout(timeoutId);
  }, [dashboard]);

  const retry = () => {
    setState("loading");
    window.setTimeout(() => setState(stateForDashboard(dashboard)), 200);
  };

  return { state, retry };
}
