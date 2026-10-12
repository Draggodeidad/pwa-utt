"use client";

import { useEffect, useState } from "react";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { isSessionCurrent, sessionEpoch } from "@/lib/pwa/offline-session";
import { HttpClient } from "@/lib/api/http-client";
import { mergeRemoteRefresh, toLocalInspectionListItem } from "../services/local-capture";
import type { InspectionListItem, LaboratoryOption } from "../types";
import type { Uuid } from "@/types/entity";

/**
 * Same-source technician list: merges pending local drafts and tombstones with
 * the authorized remote list, without clobbering unsynced local state.
 */
export function useLocalInspections(remote: readonly InspectionListItem[], catalog: readonly LaboratoryOption[], owner: Uuid, technician: string, initialError: Error | null = null) {
  const [items, setItems] = useState<readonly InspectionListItem[]>(remote);
  const [error, setError] = useState<Error | null>(initialError);
  useEffect(() => {
    let active = true;
    let refreshIndex = 0;
    const epoch = sessionEpoch();
    const lock = () => { if (!isSessionCurrent(epoch, owner)) { active = false; setItems([]); } };
    window.addEventListener("pwa-utt:session-changed", lock);
    window.addEventListener("storage", lock);
    const merge = async (authorized: readonly InspectionListItem[], index: number, authoritative: boolean) => {
      const store = await LocalStorage.open();
      try {
        if (!isSessionCurrent(epoch, owner)) return;
        if (catalog.length > 0) await store.saveCatalog(owner, catalog).catch(() => {});
        const activeCatalog = catalog.length > 0 ? catalog : await store.getCatalog(owner);
        const locals = await store.listInspections(owner);
        const findings = await store.listFindings(owner);
        const counts = new Map<string, { all: number; pending: number }>();
        for (const finding of findings) {
          if (finding.deletedAt !== null) continue;
          const count = counts.get(finding.inspectionId) ?? { all: 0, pending: 0 };
          count.all += 1;
          if (finding.status !== "resolved") count.pending += 1;
          counts.set(finding.inspectionId, count);
        }
        const localItems = locals
          .filter((local) => local.deletedAt === null)
          .map((local) => toLocalInspectionListItem(local, counts.get(local.id)?.all ?? 0, technician, activeCatalog, counts.get(local.id)?.pending ?? 0));
        const tombstoned = new Set(locals.filter((local) => local.deletedAt !== null).map((local) => local.id));
        if (active && index === refreshIndex && isSessionCurrent(epoch, owner)) setItems(mergeRemoteRefresh(localItems, [...authorized], tombstoned, authoritative));
      } finally {
        store.close();
      }
    };
    void merge(remote, refreshIndex, initialError === null).catch(() => {
      if (active && refreshIndex === 0 && isSessionCurrent(epoch, owner)) setItems(remote);
    });
    const refresh = async () => {
      if (!active || !isSessionCurrent(epoch, owner)) return;
      const index = ++refreshIndex;
      try {
        const client = new HttpClient();
        const authorized: InspectionListItem[] = [];
        let cursor: string | null = null;
        do {
          const params = new URLSearchParams({ limit: "100" });
          if (cursor) params.set("cursor", cursor);
          const page = await client.get<{ items: InspectionListItem[]; nextCursor: string | null }>(`/api/inspections?${params}`);
          authorized.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor);
        if (!active || index !== refreshIndex || !isSessionCurrent(epoch, owner)) return;
        await merge(authorized, index, true);
        if (active && index === refreshIndex) setError(null);
      } catch {
        if (active && index === refreshIndex && isSessionCurrent(epoch, owner)) setError(new Error("No fue posible refrescar las inspecciones"));
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => { active = false; window.removeEventListener("pwa-utt:session-changed", lock); window.removeEventListener("storage", lock); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [remote, catalog, owner, technician, initialError]);
  return { items, error };
}
