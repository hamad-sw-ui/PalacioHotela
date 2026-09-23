import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getSettings, logActivity, notifyAdmin, notifyUser } from "@/lib/hotel";
import { sendHotelMail } from "@/lib/mail";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.publicToken, token)).limit(1);
  if (!quote) return Response.json({ error: "Devis introuvable." }, { status: 404 });
  const settings = await getSettings();
  return Response.json({ quote: { reference: quote.reference, guestName: quote.guestName, requestKind: quote.requestKind, status: quote.status, amountTtc: quote.amountTtc, validUntil: quote.validUntil, selectedItems: quote.selectedItems, createdAt: quote.createdAt, locale: quote.locale }, acceptingQuotes: settings.acceptingQuotes });
}

export async function PATCH(request: Request, { params }: Params) {
  const { token } = await params;
  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.publicToken, token)).limit(1);
  if (!quote) return Response.json({ error: "Devis introuvable." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const settings = await getSettings();
  if (body.action !== "accept" || !settings.acceptingQuotes) return Response.json({ error: "Action indisponible." }, { status: 403 });
  if (!(["quote_sent", "negotiating"].includes(quote.status)) || !quote.amountTtc || !quote.validUntil || quote.validUntil < new Date().toISOString().slice(0, 10)) return Response.json({ error: "Ce devis ne peut plus être accepté." }, { status: 409 });
  await db.update(quoteRequests).set({ status: "accepted", updatedAt: new Date() }).where(eq(quoteRequests.id, quote.id));
  await notifyAdmin("quote", `Devis accepté · ${quote.reference}`, `${quote.guestName} a accepté votre proposition.`, "/admin?section=devis");
  await notifyUser(quote.userId, "quote", "Votre devis a été accepté", quote.reference || "", `/devis/suivi?token=${quote.publicToken}`);
  await logActivity("Devis accepté par le client", "quote", quote.id, quote.guestName, quote.userId, quote.reference || "");
  await sendHotelMail(settings.email, `Devis accepté · ${quote.reference}`, `<div style="font-family:Arial;background:#f6f4ee;padding:35px"><div style="max-width:580px;margin:auto;background:#fff;padding:40px;border-top:5px solid #234734"><h1 style="font-family:Georgia;color:#234734">Votre devis a été accepté</h1><p>${quote.guestName} a accepté le devis <strong>${quote.reference}</strong> d’un montant de <strong>${quote.amountTtc.toLocaleString("fr-FR")} XAF TTC</strong>.</p><p>Retrouvez sa demande dans votre backoffice Palacio.</p></div></div>`, settings);
  return Response.json({ ok: true, status: "accepted" });
}
