import { and, desc, eq, or, isNull, lt, sql } from "drizzle-orm";
import { NewsJournalIndex } from "@/components/news-journal-client";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { isPublicNews } from "@/lib/news-publication";

export const revalidate = 60;

async function getNews() {
  const now = new Date();
  const startOfTomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const items = await db.select().from(contentPages)
    .where(and(
      eq(contentPages.pageType, "news"),
      eq(contentPages.published, true),
      or(isNull(contentPages.publishedAt), lt(contentPages.publishedAt, startOfTomorrow)),
    ))
    .orderBy(desc(sql<Date>`coalesce(${contentPages.publishedAt}, ${contentPages.createdAt})`));
  return items.filter((item) => isPublicNews(item, now));
}

export default async function NewsIndexPage() {
  return <NewsJournalIndex items={await getNews()}/>;
}
