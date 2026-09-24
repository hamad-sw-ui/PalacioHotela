import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/hotel";
import { buildQuotePdf } from "@/lib/pdf-quote";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await getAdmin()) return Response.json({ error: "Non autorisé." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Identifiant invalide." }, { status: 400 });

  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id)).limit(1);
  if (!quote) return Response.json({ error: "Devis introuvable." }, { status: 404 });

  const kind = new URL(request.url).searchParams.get("kind") === "receipt" ? "receipt" : "quote";
  const pdf = await buildQuotePdf(quote, await getSettings(), kind);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.reference || "devis"}-${kind}-preview.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
