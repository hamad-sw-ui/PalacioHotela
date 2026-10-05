import { BookingClient } from "@/components/booking-client";
import { getPublicCatalog, getSettings } from "@/lib/hotel";
import { paymentConfiguration } from "@/lib/payments";

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ itemId?: string; checkIn?: string; checkOut?: string; guests?: string }> }) {
  const [items, settings] = await Promise.all([getPublicCatalog(), getSettings()]);
  return <BookingClient items={items} config={paymentConfiguration(settings)} initial={await searchParams}/>;
}
