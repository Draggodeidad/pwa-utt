import { Badge } from "@/components/ui/Badge";
import type { InspectionListItem } from "../types";

const resultLabels = {
  without_findings: "Sin incidencias",
  requires_attention: "Requiere atención"
} as const;

export function InspectionCard({ inspection }: { inspection: InspectionListItem }) {
  const tone = inspection.result === "without_findings" ? "success" : "warning";

  return (
    <article className="inspection-card">
      <div className="card-topline">
        <Badge tone={tone}>{resultLabels[inspection.result]}</Badge>
        <span className="muted">{inspection.date}</span>
      </div>
      <h3>{inspection.location}</h3>
      <p>{inspection.summary}</p>
      <dl>
        <div><dt>Responsable</dt><dd>{inspection.inspector}</dd></div>
        <div><dt>Hallazgos</dt><dd>{inspection.findingCount}</dd></div>
      </dl>
    </article>
  );
}
