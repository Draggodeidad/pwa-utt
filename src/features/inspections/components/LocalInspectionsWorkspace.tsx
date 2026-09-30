"use client";

import { InspectionsWorkspace } from "./InspectionsWorkspace";
import { useLocalInspections } from "../hooks/use-local-inspections";
import type { InspectionListItem, LaboratoryOption } from "../types";
import type { Uuid } from "@/types/entity";

export function LocalInspectionsWorkspace({ remote, catalog, owner, technician }: { remote: readonly InspectionListItem[]; catalog: readonly LaboratoryOption[]; owner: Uuid; technician: string }) {
  const { items } = useLocalInspections(remote, catalog, owner, technician);
  return <InspectionsWorkspace inspections={items} />;
}