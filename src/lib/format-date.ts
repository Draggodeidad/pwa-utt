export function parseDateOnly(value: string | null | undefined): Date | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateOnly(value: string | null | undefined, formatter: Intl.DateTimeFormat, missing = "Sin fecha"): string {
  const date = parseDateOnly(value);
  if (!date) {
    if (typeof value === "string" && value.trim() !== "" && process.env.NODE_ENV !== "production") {
      console.warn(`[format-date] fecha inválida en el listado de inspecciones: "${value}"`);
    }
    return missing;
  }
  return formatter.format(date);
}