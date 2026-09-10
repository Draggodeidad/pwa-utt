"use client";

import { useEffect, useMemo, useState } from "react";
import type { CoordinationFinding, CoordinationFindingsState, FindingFilters, FindingPriority, FindingStatus } from "../types";

const initialFilters: FindingFilters = { query: "", priority: "all", status: "all" };

function getScreenState(findings: readonly CoordinationFinding[] | undefined): CoordinationFindingsState {
  if (!findings) return "error";
  return findings.length === 0 ? "empty" : "ready";
}

export function useCoordinationFindings(initialFindings: readonly CoordinationFinding[] | undefined) {
  const [state, setState] = useState<CoordinationFindingsState>("loading");
  const [findings, setFindings] = useState<readonly CoordinationFinding[]>(initialFindings ?? []);
  const [filters, setFilters] = useState<FindingFilters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialFindings?.[0]?.id);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setState(getScreenState(initialFindings)), 250);
    return () => window.clearTimeout(timeoutId);
  }, [initialFindings]);

  const filteredFindings = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("es-MX");
    return findings.filter((finding) => {
      const matchesQuery = !query || [finding.folio, finding.laboratory, finding.description].some((value) => value.toLocaleLowerCase("es-MX").includes(query));
      return matchesQuery && (filters.priority === "all" || finding.priority === filters.priority) && (filters.status === "all" || finding.status === filters.status);
    });
  }, [filters, findings]);

  const selectedFinding = findings.find((finding) => finding.id === selectedId);
  const pendingCount = findings.filter((finding) => finding.status !== "resolved").length;

  useEffect(() => {
    if (!selectedId || filteredFindings.some((finding) => finding.id === selectedId)) return;
    setSelectedId(filteredFindings[0]?.id);
  }, [filteredFindings, selectedId]);

  const retry = () => {
    setState("loading");
    window.setTimeout(() => setState(getScreenState(initialFindings)), 200);
  };

  const clearFilters = () => setFilters(initialFilters);

  const saveFinding = (changes: Pick<CoordinationFinding, "priority" | "status" | "internalNote">) => {
    if (!selectedId) return;
    setIsSaving(true);
    window.setTimeout(() => {
      setFindings((currentFindings) => currentFindings.map((finding) => finding.id === selectedId ? { ...finding, ...changes } : finding));
      setIsSaving(false);
    }, 200);
  };

  return {
    state,
    filters,
    filteredFindings,
    selectedFinding,
    selectedId,
    pendingCount,
    isSaving,
    retry,
    clearFilters,
    saveFinding,
    setFilters,
    setSelectedId,
  };
}
