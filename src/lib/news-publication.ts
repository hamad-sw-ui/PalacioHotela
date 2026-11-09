export type NewsPublicationFields = {
  published: boolean;
  publishedAt: Date | string | null;
  createdAt: Date | string;
};

export function normalizePublicationDate(value: unknown, field: string): Date {
  const date = value instanceof Date
    ? value
    : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : null;

  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`[Palacio] Invalid ${field} date in published content`);
  }
  return date;
}

export function newsDisplayDate(item: NewsPublicationFields): Date {
  return normalizePublicationDate(item.publishedAt ?? item.createdAt, item.publishedAt ? "publishedAt" : "createdAt");
}

export function isPublicNews(item: NewsPublicationFields, now = new Date()): boolean {
  if (!item.published || !item.publishedAt) return item.published;
  const startOfTomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return normalizePublicationDate(item.publishedAt, "publishedAt").getTime() < startOfTomorrow;
}

export function publicNewsOrder<T extends NewsPublicationFields>(items: T[], now = new Date()): T[] {
  return items
    .filter((item) => isPublicNews(item, now))
    .sort((a, b) => newsDisplayDate(b).getTime() - newsDisplayDate(a).getTime());
}
