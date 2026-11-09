export type NewsPublicationFields = {
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
};

export function newsDisplayDate(item: NewsPublicationFields): Date {
  return item.publishedAt ?? item.createdAt;
}

export function isPublicNews(item: NewsPublicationFields, now = new Date()): boolean {
  if (!item.published || !item.publishedAt) return item.published;
  const startOfTomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return item.publishedAt.getTime() < startOfTomorrow;
}

export function publicNewsOrder<T extends NewsPublicationFields>(items: T[], now = new Date()): T[] {
  return items
    .filter((item) => isPublicNews(item, now))
    .sort((a, b) => newsDisplayDate(b).getTime() - newsDisplayDate(a).getTime());
}
