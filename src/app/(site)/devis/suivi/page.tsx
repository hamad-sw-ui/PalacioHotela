import { QuoteTrackingClient } from "@/components/quote-tracking-client";

export default async function QuoteTrackingPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <QuoteTrackingClient token={token || ""}/>;
}
