import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { InspectionListItem } from "../types";

const resultLabels = {
  without_findings: "Sin incidencias",
  requires_attention: "Requiere atención"
} as const;

export function InspectionCard({ inspection }: { inspection: InspectionListItem }) {
  const tone = inspection.result === "without_findings" ? "success" : "warning";
  const badgeClassName = tone === "success" ? "border-0 bg-emerald-100 text-emerald-700" : "border-0 bg-amber-100 text-amber-800";

  return (
    <Card className="rounded-2xl border-border p-[22px] shadow-[0_7px_20px_rgb(36_55_95_/_6%)]">
      <div className="flex items-center justify-between gap-2.5">
        <Badge className={badgeClassName}>{resultLabels[inspection.result]}</Badge>
        <span className="text-xs text-muted-foreground">{inspection.date}</span>
      </div>
      <h3 className="mb-2 mt-5 text-xl font-semibold">{inspection.location}</h3>
      <p className="min-h-[75px] leading-relaxed text-muted-foreground">{inspection.summary}</p>
      <dl className="mt-[18px] border-t pt-[14px]">
        <div className="my-1.5 flex justify-between gap-3"><dt className="text-[.82rem] text-muted-foreground">Responsable</dt><dd className="m-0 text-right text-[.82rem] font-bold">{inspection.inspector}</dd></div>
        <div className="my-1.5 flex justify-between gap-3"><dt className="text-[.82rem] text-muted-foreground">Hallazgos</dt><dd className="m-0 text-right text-[.82rem] font-bold">{inspection.findingCount}</dd></div>
      </dl>
    </Card>
  );
}
