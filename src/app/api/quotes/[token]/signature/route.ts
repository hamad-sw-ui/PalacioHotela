import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quoteRequests } from "@/db/schema";
import { saveSignatureImage } from "@/lib/signature-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.publicToken, token)).limit(1);
    if (!quote) return Response.json({ error: "Devis introuvable." }, { status: 404 });
    if (!["quote_sent", "negotiating"].includes(quote.status) || (quote.validUntil && quote.validUntil < new Date().toISOString().slice(0, 10))) return Response.json({ error: "Ce devis ne peut plus être signé." }, { status: 409 });
    const body = await request.json().catch(() => ({})) as { signature?: unknown; signerName?: unknown };
    const signerName = typeof body.signerName === "string" ? body.signerName.trim().slice(0, 180) : "";
    if (signerName.length < 2) return Response.json({ error: "Le nom du signataire est requis." }, { status: 400 });
    const saved = await saveSignatureImage(body.signature);
    const [updated] = await db.update(quoteRequests).set({ clientSignatureUrl: saved.url, clientSignerName: signerName, updatedAt: new Date() }).where(eq(quoteRequests.id, quote.id)).returning({ id: quoteRequests.id, clientSignatureUrl: quoteRequests.clientSignatureUrl, clientSignerName: quoteRequests.clientSignerName });
    return Response.json({ ok: true, signatureUrl: updated.clientSignatureUrl, signerName: updated.clientSignerName });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Signature invalide." }, { status: 400 });
  }
}
