import { AvailabilityClient } from "@/components/availability-client";
import { fitsGuestDemand, parseAvailabilityQuery } from "@/lib/availability-search";
import { getPublicCatalog, remainingAvailability } from "@/lib/hotel";

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }> }) {
  const stay = parseAvailabilityQuery(await searchParams);
  if (!stay) return <AvailabilityClient stay={null} results={[]}/>;
  const items = await getPublicCatalog();
  const checked = await Promise.all(items.map(async (item) => ({ item, remaining: await remainingAvailability(item, stay.checkIn, stay.checkOut) })));
  const results = checked.filter((entry) => fitsGuestDemand(entry.item.capacity, entry.remaining, stay.guests));
  return <AvailabilityClient stay={stay} results={results}/>;
}
