import { notFound } from "next/navigation";
import { DetailClient } from "@/components/detail-client";
import { getPublicCatalog } from "@/lib/hotel";

export default async function CatalogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const items = await getPublicCatalog();
  const item = items.find((entry) => entry.slug === slug);
  if (!item) notFound();
  const related = items.filter((entry) => entry.id !== item.id && (entry.category === item.category || entry.featured)).slice(0, 3);
  return <DetailClient item={item} related={related}/>;
}
