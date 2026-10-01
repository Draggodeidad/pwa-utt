"use client";

import { InspectionsWorkspace } from "./InspectionsWorkspace";
import { useLocalInspections } from "../hooks/use-local-inspections";
import type { InspectionListItem, LaboratoryOption } from "../types";
import type { Uuid } from "@/types/entity";

export function LocalInspectionsWorkspace({ remote, catalog, owner, technician, error = null }: { remote: readonly InspectionListItem[]; catalog: readonly LaboratoryOption[]; owner: Uuid; technician: string; error?: Error | null }) {
  const { items, error: readError } = useLocalInspections(remote, catalog, owner, technician, error);
  return <InspectionsWorkspace inspections={items} error={readError} />;
}
