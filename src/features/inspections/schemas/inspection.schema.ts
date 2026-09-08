export type InspectionDraftInput = {
  location: string;
  date: string;
  summary: string;
};

/** Schema boundary reserved for field validation when the creation flow is implemented. */
export function hasRequiredInspectionFields(input: InspectionDraftInput) {
  return Boolean(input.location.trim() && input.date);
}
