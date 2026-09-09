"use client";

import { getConnectivityState } from "@/lib/pwa/connectivity";
import { useEffect, useState } from "react";
import type { InspectionListItem } from "../types";

export type InspectionListState = "loading" | "success" | "empty" | "filtered-empty" | "error" | "offline-with-data";

type UseInspectionListStateInput = { records: readonly InspectionListItem[]; hasActiveFilters: boolean; isLoading?: boolean; error?: Error | null };

/** Maps repository/query output and browser connectivity to the supported list UX states. */
export function useInspectionListState({ records, hasActiveFilters, isLoading = false, error = null }: UseInspectionListStateInput) {
  const [connectivity, setConnectivity] = useState(getConnectivityState);
  useEffect(() => { const update = () => setConnectivity(getConnectivityState()); window.addEventListener("online", update); window.addEventListener("offline", update); return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); }; }, []);
  const state: InspectionListState = isLoading && records.length === 0 ? "loading" : error && records.length === 0 ? "error" : connectivity === "offline" && records.length > 0 ? "offline-with-data" : records.length > 0 ? "success" : hasActiveFilters ? "filtered-empty" : "empty";
  return { state, connectivity } as const;
}
