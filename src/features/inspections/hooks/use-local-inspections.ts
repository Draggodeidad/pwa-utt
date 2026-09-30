"use client";

import { useEffect, useState } from "react";
import { LocalStorage } from "@/lib/pwa/offline-storage";
import { mergeRemoteRefresh, toLocalInspectionListItem } from "../services/local-capture";
import type { InspectionListItem, LaboratoryOption } from "../types";
import type { Uuid } from "@/types/entity";

/**
 * Same-source technician list: merges pending local drafts and tombstones with
 * the authorized remote list, without clobbering unsynced local state.
 */
export function useLocalInspections(remote: readonly InspectionListItem[], catalog: readonly LaboratoryOption[], owner: Uuid, technician: string) {
  const [items, setItems] = useState<readonly InspectionListItem[]>(remote);
  useEffect(() => {
    let active = true;
    LocalStorage.open().then(async (store) => {
      try {
        if (catalog.length > 0) await store.saveCatalog(owner, catalog).catch(() => {});
        const locals = await store.listInspections(owner);
        const findings = await store.listFindings(owner);
        const counts = new Map<string, number>();
        for (const finding of findings) {
          if (finding.deletedAt === null) counts.set(finding.inspectionId, (counts.get(finding.inspectionId) ?? 0) + 1);
        }
        const localItems = locals
          .filter((local) => local.deletedAt === null)
          .map((local) => toLocalInspectionListItem(local, counts.get(local.id) ?? 0, technician, catalog));
        const tombstoned = new Set(locals.filter((local) => local.deletedAt !== null).map((local) => local.id));
        if (active) setItems(mergeRemoteRefresh(localItems, [...remote], tombstoned));
      } finally {
        store.close();
      }
    }).catch(() => {
      if (active) setItems(remote);
    });
    return () => { active = false; };
  }, [remote, catalog, owner, technician]);
  return { items };
}
