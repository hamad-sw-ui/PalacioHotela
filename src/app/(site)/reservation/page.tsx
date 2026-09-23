import { BookingClient } from "@/components/booking-client";
import { getPublicCatalog } from "@/lib/hotel";
import { paymentConfiguration } from "@/lib/payments";

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ itemId?: string; checkIn?: string; checkOut?: string; guests?: string }> }) {
  return <BookingClient items={await getPublicCatalog()} config={paymentConfiguration()} initial={await searchParams}/>;
}
