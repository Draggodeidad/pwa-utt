"use client";

import { useMemo, useState } from "react";
import type { InspectionListItem, InspectionResult, InspectionWorkflowStatus } from "../types";

export type InspectionResultFilter = "all" | InspectionResult;
export type InspectionStatusFilter = "all" | InspectionWorkflowStatus;

export function useInspectionFilters(inspections: readonly InspectionListItem[]) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<InspectionResultFilter>("all");
  const [status, setStatus] = useState<InspectionStatusFilter>("all");

  const filteredInspections = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es-MX");
    return inspections.filter((inspection) => {
      const matchesQuery = !term || [inspection.id, inspection.location, inspection.laboratoryCode, inspection.inspector].some((value) => value.toLocaleLowerCase("es-MX").includes(term));
      return matchesQuery && (result === "all" || inspection.result === result) && (status === "all" || inspection.workflowStatus === status);
    });
  }, [inspections, query, result, status]);

  const hasActiveFilters = Boolean(query.trim() || result !== "all" || status !== "all");
  const clearFilters = () => { setQuery(""); setResult("all"); setStatus("all"); };

  return { query, result, status, filteredInspections, hasActiveFilters, clearFilters, setQuery, setResult, setStatus };
}
