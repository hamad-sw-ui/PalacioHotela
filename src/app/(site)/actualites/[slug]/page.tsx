import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsArticle } from "@/components/news-journal-client";
import { getPublicPage } from "@/lib/hotel";
import { isPublicNews } from "@/lib/news-publication";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

async function getNewsPage(params: Props["params"]) {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page || page.pageType !== "news" || !isPublicNews(page)) return null;
  return page;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getNewsPage(params);
  if (!page) return {};
  const description = (page.summaryFr || page.bodyFr).slice(0, 180);
  return {
    title: `${page.titleFr} | Palacio Hotel`,
    description,
    openGraph: {
      type: "article",
      title: page.titleFr,
      description,
      ...(page.image ? { images: [page.image] } : {}),
      publishedTime: (page.publishedAt ?? page.createdAt).toISOString(),
    },
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const page = await getNewsPage(params);
  if (!page) notFound();
  return <NewsArticle page={page}/>;
}
