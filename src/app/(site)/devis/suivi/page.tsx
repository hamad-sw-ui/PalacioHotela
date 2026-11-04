import { QuoteTrackingClient } from "@/components/quote-tracking-client";

// Private per-token page: must never be cached or prerendered.
export const dynamic = "force-dynamic";

export default async function QuoteTrackingPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <QuoteTrackingClient token={token || ""}/>;
}
