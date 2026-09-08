/** Read model owned by the coordination dashboard, composed from inspections and findings. */
export type CoordinationSummary = {
  inspectionCount: number;
  inspectionCountRequiringAttention: number;
  findingCount: number;
  pendingFindingCount: number;
};
