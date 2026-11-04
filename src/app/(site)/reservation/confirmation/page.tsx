import { BookingConfirmationClient } from "@/components/booking-confirmation-client";

// Private per-token page tied to a payment: never cached or prerendered.
export const dynamic = "force-dynamic";

export default async function BookingConfirmationPage({ searchParams }: { searchParams: Promise<{ token?: string; session_id?: string; payment?: string }> }) {
  const query = await searchParams;
  return <BookingConfirmationClient token={query.token || ""} sessionId={query.session_id} payment={query.payment}/>;
}
