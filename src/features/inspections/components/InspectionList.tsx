import { InspectionCard } from "./InspectionCard";
import type { InspectionListItem } from "../types";

export function InspectionList({ inspections }: { inspections: readonly InspectionListItem[] }) {
  return <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">{inspections.map((inspection) => <InspectionCard key={inspection.id} inspection={inspection} />)}</div>;
}
