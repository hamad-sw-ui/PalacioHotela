import { notFound } from "next/navigation";
import { DetailClient } from "@/components/detail-client";
import { getPublicCatalog, getSettings } from "@/lib/hotel";
import { paymentConfiguration } from "@/lib/payments";

// Detail content comes from tag-cached catalog/settings. The optional stay query only
// prefills the booking form on the client (DetailClient reads it via useSearchParams),
// so cached rendering per slug is safe and the page no longer needs request-time params.
export const revalidate = 60;

export default async function CatalogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [items, settings] = await Promise.all([getPublicCatalog(), getSettings()]);
  const item = items.find((entry) => entry.slug === slug);
  if (!item) notFound();
  const related = items.filter((entry) => entry.id !== item.id && (entry.category === item.category || entry.featured)).slice(0, 3);
  return <DetailClient item={item} related={related} config={paymentConfiguration(settings)} />;
}
