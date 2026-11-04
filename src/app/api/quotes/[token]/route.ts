import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { catalogItems, quoteRequests } from "@/db/schema";
import { expireOverdueQuotes, getSettings, logActivity, notifyAdmin, notifyUser, demandConflict, validDateRange, withCatalogLocks } from "@/lib/hotel";
import { sendQuoteCancellationEmails, sendQuoteStateEmails } from "@/lib/mail";
import { buildQuotePdf } from "@/lib/pdf-quote";
import { demandRanges, hasDemandWindow } from "@/lib/availability";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  await expireOverdueQuotes().catch((error) => console.error("[Palacio] Auto-expire quotes:", error));
  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.publicToken, token)).limit(1);
  if (!quote) return Response.json({ error: "Devis introuvable." }, { status: 404 });
  const settings = await getSettings();
  return Response.json({ quote: { reference: quote.reference, guestName: quote.guestName, requestKind: quote.requestKind, status: quote.status, amountTtc: quote.amountTtc, estimatedTotal: quote.estimatedTotal, validUntil: quote.validUntil, selectedItems: quote.selectedItems, createdAt: quote.createdAt, locale: quote.locale, pdfTemplateVersion: quote.pdfTemplateVersion, clientSignatureUrl: quote.clientSignatureUrl, clientSignerName: quote.clientSignerName, clientSignedAt: quote.clientSignedAt }, acceptingQuotes: settings.acceptingQuotes });
}

export async function PATCH(request: Request, { params }: Params) {
  const { token } = await params;
  const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.publicToken, token)).limit(1);
  if (!quote) return Response.json({ error: "Devis introuvable." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const settings = await getSettings();
  if (body.action === "cancel") {
    if (!["new", "in_review", "quote_sent", "negotiating"].includes(quote.status)) return Response.json({ error: "Cette demande ne peut plus être annulée." }, { status: 409 });
    const [record] = await db.update(quoteRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(quoteRequests.id, quote.id)).returning();
    await sendQuoteCancellationEmails(record, settings, new URL(request.url).origin);
    await notifyUser(record.userId, "quote", "Votre demande de devis a été annulée", record.reference || "", `/devis/suivi?token=${record.publicToken}`);
    await notifyAdmin("quote", "Devis annulé par le client", record.reference || record.guestName, `/admin?section=devis&quote=${record.id}`);
    await logActivity("Devis annulé par le client", "quote", record.id, record.guestName, record.userId, record.reference || "");
    return Response.json({ ok: true, status: record.status });
  }
  if (body.action !== "accept" || !settings.acceptingQuotes) return Response.json({ error: "Action indisponible." }, { status: 403 });
  if (!( ["quote_sent", "negotiating"].includes(quote.status)) || !quote.amountTtc || !quote.validUntil || quote.validUntil < new Date().toISOString().slice(0, 10)) return Response.json({ error: "Ce devis ne peut plus être accepté." }, { status: 409 });
  if (quote.pdfTemplateVersion >= 2 && process.env.QUOTE_REQUIRE_CLIENT_SIGNATURE !== "false" && !quote.clientSignatureUrl) return Response.json({ error: "Veuillez signer le devis avant de l'accepter." }, { status: 400 });
  const fallback = { start: quote.checkIn, end: quote.checkOut };
  const undatedLine = quote.selectedItems.find((line) => !hasDemandWindow(line, fallback));
  if (undatedLine) return Response.json({ error: `Ce devis ne peut pas être accepté sans date pour « ${undatedLine.name_fr} ». Contactez l’hôtel pour le compléter.` }, { status: 409 });
  const groups = new Map<number, typeof quote.selectedItems>();
  for (const line of quote.selectedItems) {
    const lines = groups.get(line.property_id) || [];
    lines.push(line);
    groups.set(line.property_id, lines);
  }
  for (const lines of groups.values()) {
    if (lines.some((line) => demandRanges(line, fallback).some((range) => !validDateRange(range.start, range.end)))) {
      return Response.json({ error: "Les dates de ce devis ne sont plus valides. Contactez l’hôtel pour le mettre à jour." }, { status: 409 });
    }
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  const accepted = await withCatalogLocks([...groups.keys()], async () => {
    const [latest] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, quote.id)).limit(1);
    if (!latest || latest.status !== quote.status || latest.updatedAt.getTime() !== quote.updatedAt.getTime()) return null;
    for (const [itemId, lines] of groups) {
      const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, itemId)).limit(1);
      if (!item) return null;
      const blocked = await demandConflict(item, lines, fallback, { excludeQuoteId: quote.id });
      if (blocked) return { conflict: blocked.nameFr } as const;
    }
    const [record] = await db.update(quoteRequests).set({ status: "accepted", clientSignedAt: latest.clientSignatureUrl ? new Date() : null, clientAcceptanceIp: forwarded, clientAcceptanceUserAgent: request.headers.get("user-agent")?.slice(0, 1000) || null, updatedAt: new Date() }).where(and(eq(quoteRequests.id, quote.id), eq(quoteRequests.status, quote.status), eq(quoteRequests.updatedAt, quote.updatedAt))).returning();
    return record || null;
  });
  if (!accepted) return Response.json({ error: "Ce devis a changé ou n’est plus disponible. Actualisez la page ou contactez l’hôtel." }, { status: 409 });
  if ("conflict" in accepted) return Response.json({ error: `${accepted.conflict} n’est plus disponible pour les dates demandées. Contactez l’hôtel pour obtenir une nouvelle proposition.` }, { status: 409 });
  await notifyAdmin("quote", `Devis accepté · ${quote.reference}`, `${quote.guestName} a accepté votre proposition.`, `/admin?section=devis&quote=${quote.id}`);
  await notifyUser(quote.userId, "quote", "Votre devis a été accepté", quote.reference || "", `/devis/suivi?token=${quote.publicToken}`);
  await logActivity("Devis accepté par le client", "quote", quote.id, quote.guestName, quote.userId, quote.reference || "");
  const signedPdf = await buildQuotePdf(accepted, settings, "quote");
  await sendQuoteStateEmails(accepted, settings, "accepted", [{ filename: `${quote.reference}-devis-signe.pdf`, content: Buffer.from(signedPdf) }], new URL(request.url).origin);
  return Response.json({ ok: true, status: "accepted" });
}
