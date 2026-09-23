import { notFound } from "next/navigation";
import { ContentPageClient } from "@/components/content-page-client";
import { getPublicPage } from "@/lib/hotel";

export default async function EditableContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) notFound();
  return <ContentPageClient page={page}/>;
}
