import { notFound } from "next/navigation";
import { DetailClient } from "@/components/detail-client";
import { getPublicCatalog, getSettings } from "@/lib/hotel";
import { paymentConfiguration } from "@/lib/payments";
import { parseAvailabilityQuery } from "@/lib/availability-search";

export default async function CatalogDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [items, settings] = await Promise.all([getPublicCatalog(), getSettings()]);
  const item = items.find((entry) => entry.slug === slug);
  if (!item) notFound();
  const related = items.filter((entry) => entry.id !== item.id && (entry.category === item.category || entry.featured)).slice(0, 3);
  return <DetailClient item={item} related={related} items={items} config={paymentConfiguration(settings)} initialStay={parseAvailabilityQuery(query) ?? undefined}/>;
}
