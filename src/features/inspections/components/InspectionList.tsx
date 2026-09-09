import { InspectionCard } from "./InspectionCard";
import type { InspectionListItem } from "../types";

export function InspectionList({ inspections }: { inspections: readonly InspectionListItem[] }) {
  return <div className="space-y-3">{inspections.map((inspection) => <InspectionCard key={inspection.id} inspection={inspection} />)}</div>;
}
