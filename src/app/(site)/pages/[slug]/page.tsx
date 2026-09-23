import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { contentPages } from "@/db/schema";
import { ContentPageClient } from "@/components/content-page-client";
import { ensureSeeded } from "@/lib/seed";

export default async function EditableContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await ensureSeeded();
  const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, slug), eq(contentPages.published, true))).limit(1);
  if (!page) notFound();
  return <ContentPageClient page={page}/>;
}
