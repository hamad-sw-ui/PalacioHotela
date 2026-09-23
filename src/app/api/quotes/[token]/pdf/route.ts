import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getSettings } from "@/lib/hotel";
import { buildQuotePdf } from "@/lib/pdf-quote";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.publicToken, token)).limit(1);
  if (!quote) return Response.json({ error: "Devis introuvable." }, { status: 404 });
  const kind = new URL(request.url).searchParams.get("kind") === "receipt" ? "receipt" : "quote";
  if (kind === "quote" && (!quote.amountTtc || !["quote_sent", "negotiating", "accepted", "rejected", "expired"].includes(quote.status))) return Response.json({ error: "Le devis n'est pas encore disponible." }, { status: 403 });
  const pdf = await buildQuotePdf(quote, await getSettings(), kind);
  return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${quote.reference || "devis"}-${kind}.pdf"`, "Cache-Control": "private, no-store" } });
}
