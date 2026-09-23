import { QuoteClient } from "@/components/quote-client";
import { getPublicCatalog } from "@/lib/hotel";

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ itemId?: string; kind?: string }> }) {
  return <QuoteClient items={await getPublicCatalog()} initial={await searchParams}/>;
}
