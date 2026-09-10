import { InspectionCard } from "./InspectionCard";
import type { InspectionListItem } from "../types";

export function InspectionList({ inspections }: { inspections: readonly InspectionListItem[] }) {
  return <div className={s.list}>{inspections.map((inspection) => <InspectionCard key={inspection.id} inspection={inspection} />)}</div>;
}

const s = {
  list: "space-y-3",
};
