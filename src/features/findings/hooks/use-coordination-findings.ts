"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { HttpClient } from "@/lib/api/http-client";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { isSessionCurrent, readLocalSession, rememberLocalSession, sessionEpoch } from "@/lib/pwa/offline-session";
import { runBrowserQueue } from "@/lib/pwa/sync/browser-runner";
import { saveCoordinationFollowup } from "../services/coordination-followup";
import type { CoordinationFinding, CoordinationFindingsState, FindingDto, FindingFilters, FindingListPage, FindingPriority, FindingStatus } from "../types";

const initialFilters: FindingFilters = { query: "", priority: "all", status: "all" };

function display(item: FindingDto, syncState: CoordinationFinding["syncState"] = "confirmed"): CoordinationFinding {
  return {
    id: item.id, inspectionId: item.inspectionId, folio: item.folio, title: item.title,
    description: item.description, laboratory: item.location, date: item.date, technician: item.technician,
    priority: item.priority, status: item.status, version: item.version, syncState,
  };
}

export function useCoordinationFindings(owner: string) {
  const [state, setState] = useState<CoordinationFindingsState>("loading");
  const [remote, setRemote] = useState<FindingDto[]>([]);
  const [findings, setFindings] = useState<CoordinationFinding[]>([]);
  const [filters, setFilters] = useState<FindingFilters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const requestRef = useRef(0);

  const load = useCallback(async (cursor: string | null, priority: FindingFilters["priority"], status: FindingFilters["status"]) => {
    const requestId = ++requestRef.current;
    const epoch = sessionEpoch();
    setState((current) => current === "ready" ? current : "loading");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      if (priority !== "all") params.set("priority", priority);
      if (status !== "all") params.set("status", status);
      const client = new HttpClient();
      const session = await client.get<{ user: { id: string; role: string; displayName?: string } }>("/api/session");
      if (session.user.id !== owner || session.user.role !== "coordinator") {
        if (requestId === requestRef.current) setState("forbidden");
        return;
      }
      if (!isSessionCurrent(epoch)) return;
      if (readLocalSession()?.userId !== owner) rememberLocalSession({ userId: owner, displayName: session.user.displayName ?? "" });
      const page = await client.get<FindingListPage>(`/api/findings?${params}`);
      if (requestId !== requestRef.current || !isSessionCurrent(epoch, owner)) return;
      const authorized = page.items.filter((item) => item.workflowStatus === "completed");
      const storage = await LocalStorage.open();
      try {
        const [locals, queue, conflicts] = await Promise.all([
          storage.listFindings(owner), storage.listQueue(owner), storage.listConflicts(owner),
        ]);
        if (requestId !== requestRef.current || !isSessionCurrent(epoch, owner)) return;
        const localById = new Map(locals.map((item) => [item.id, item]));
        const pending = new Set(queue.map((item) => item.entityId));
        const conflicted = new Set(conflicts.filter((item) => !item.resolvedAt).map((item) => item.entityId));
        setRemote(authorized);
        setFindings(authorized.map((item) => {
          const local = localById.get(item.id);
          const hasLocalEdit = !!local && (pending.has(item.id) || local.syncStatus !== "synced" || local.version > item.version);
          return display(hasLocalEdit ? { ...item, priority: local.priority, status: local.status } : item,
            conflicted.has(item.id) ? "conflict" : hasLocalEdit ? "pending" : "confirmed");
        }));
        setNextCursor(page.nextCursor);
        setRefreshError("");
        setState(authorized.length === 0 ? "empty" : "ready");
      } finally {
        storage.close();
      }
    } catch (error) {
      if (requestId !== requestRef.current || !isSessionCurrent(epoch, owner)) return;
      if (error instanceof ApiClientError && [401, 403].includes(error.status)) setState("forbidden");
      else {
        setRefreshError("No fue posible actualizar los hallazgos. Se conserva la edición local.");
        setState((current) => current === "ready" ? current : "error");
      }
    }
  }, [owner]);

  useEffect(() => {
    const refresh = () => { void load(pageCursors[pageIndex], filters.priority, filters.status); };
    refresh();
    window.addEventListener("pwa-utt:queue-changed", refresh);
    window.addEventListener("pwa-utt:session-changed", refresh);
    return () => {
      requestRef.current++;
      window.removeEventListener("pwa-utt:queue-changed", refresh);
      window.removeEventListener("pwa-utt:session-changed", refresh);
    };
  }, [load, pageCursors, pageIndex, filters.priority, filters.status]);

  const filteredFindings = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("es-MX");
    return findings.filter((finding) => !query || [finding.folio, finding.laboratory, finding.title, finding.description].some((value) => value.toLocaleLowerCase("es-MX").includes(query)));
  }, [filters.query, findings]);

  const selectedFinding = filteredFindings.find((finding) => finding.id === selectedId);
  const pendingCount = findings.filter((finding) => finding.status !== "resolved").length;

  useEffect(() => {
    if (filteredFindings.some((finding) => finding.id === selectedId)) return;
    setSelectedId(filteredFindings[0]?.id);
  }, [filteredFindings, selectedId]);

  const setServerFilters = (next: FindingFilters) => {
    setFilters(next);
    if (next.priority !== filters.priority || next.status !== filters.status) {
      setPageCursors([null]);
      setPageIndex(0);
    }
  };

  const saveFinding = async (changes: { priority: FindingPriority; status: FindingStatus }) => {
    if (!selectedId || isSaving || !isSessionCurrent(sessionEpoch(), owner)) return;
    const item = remote.find((finding) => finding.id === selectedId);
    if (!item) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const storage = await LocalStorage.open();
      let intent;
      try {
        intent = await saveCoordinationFollowup(storage, owner, item, changes.priority, changes.status);
      } finally {
        storage.close();
      }
      if (intent) {
        setFindings((current) => current.map((finding) => finding.id === selectedId ? { ...finding, ...changes, syncState: "pending" } : finding));
        window.dispatchEvent(new Event("pwa-utt:sync-now"));
        void runBrowserQueue().catch(() => {});
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el seguimiento");
    } finally {
      setIsSaving(false);
    }
  };

  const nextPage = () => {
    if (!nextCursor) return;
    setPageCursors((current) => [...current.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((current) => current + 1);
  };
  const previousPage = () => setPageIndex((current) => Math.max(0, current - 1));
  const clearFilters = () => setServerFilters(initialFilters);
  const retry = () => void load(pageCursors[pageIndex], filters.priority, filters.status);

  return { state, filters, filteredFindings, selectedFinding, selectedId, pendingCount, isSaving, saveError, refreshError,
    pageIndex, nextCursor, nextPage, previousPage, retry, clearFilters, saveFinding, setFilters: setServerFilters, setSelectedId };
}
