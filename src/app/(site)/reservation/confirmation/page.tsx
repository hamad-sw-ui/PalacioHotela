import { BookingConfirmationClient } from "@/components/booking-confirmation-client";

export default async function BookingConfirmationPage({ searchParams }: { searchParams: Promise<{ token?: string; session_id?: string; payment?: string }> }) {
  const query = await searchParams;
  return <BookingConfirmationClient token={query.token || ""} sessionId={query.session_id} payment={query.payment}/>;
}
