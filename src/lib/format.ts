export function formatXaf(amount: number, locale: string = "fr") {
  return `${new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 0 }).format(amount)} XAF`;
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
}

export function validDateRange(start: unknown, end: unknown) {
  if (typeof start !== "string" || typeof end !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
  if (new Date(from).toISOString().slice(0, 10) !== start || new Date(to).toISOString().slice(0, 10) !== end) return false;
  return start >= new Date().toISOString().slice(0, 10) && daysBetween(start, end) > 0 && daysBetween(start, end) <= 365;
}
