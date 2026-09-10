/** Read model owned by the coordination dashboard, composed from inspections and findings. */
export type CoordinationSummary = {
  inspectionCount: number;
  inspectionCountRequiringAttention: number;
  findingCount: number;
  pendingFindingCount: number;
};

export type DashboardInspection = {
  id: string;
  location: string;
  date: string;
  inspector: string;
  findingCount: number;
  result: "without_findings" | "requires_attention";
};

export type CoordinationDashboard = {
  summary: CoordinationSummary;
  attentionInspections: readonly DashboardInspection[];
  recentInspections: readonly DashboardInspection[];
};

export type DashboardState = "loading" | "ready" | "empty" | "error";
