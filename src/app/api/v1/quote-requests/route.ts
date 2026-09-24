import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quoteRequests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { demandRanges } from "@/lib/availability";
import { findActiveUserIdByEmail, getPublicCatalog, getSettings, logActivity, notifyAdmin, notifyUser, remainingAvailability, validDateRange } from "@/lib/hotel";
import { sendQuoteReceivedEmails } from "@/lib/mail";
import { buildQuotePdf } from "@/lib/pdf-quote";
import { quoteTotal } from "@/lib/quote-pricing";
import { enrichQuoteItems } from "@/lib/quote-items";
import { currentQuotePdfVersion } from "@/lib/quote-pdf-version";
import { parseError, quoteInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    // A signed-in client never dictates its own contact details: the account's are used instead.
    const user = await getCurrentUser();
    const body = await request.json();
    const input = quoteInput.parse(user ? {
      ...body,
      guestName: user.fullName,
      guestEmail: user.email,
      guestPhone: user.phone || body.guestPhone,
    } : body);
    if ((input.checkIn || input.checkOut) && (!input.checkIn || !input.checkOut || !validDateRange(input.checkIn, input.checkOut))) return Response.json({ error: "Dates invalides / Invalid dates" }, { status: 400 });
    const catalog = await getPublicCatalog();
    for (const selected of input.selectedItems) {
      const item = catalog.find((entry) => entry.id === selected.property_id);
      if (!item) return Response.json({ error: "Un élément sélectionné n'est plus disponible." }, { status: 400 });
      for (const range of demandRanges(selected, { start: input.checkIn, end: input.checkOut })) {
        if (!validDateRange(range.start, range.end)) return Response.json({ error: "Les dates d'un élément sont invalides." }, { status: 400 });
        if (await remainingAvailability(item, range.start, range.end) < selected.quantity) return Response.json({ error: `${item.nameFr} n'est plus disponible à ces dates.` }, { status: 409 });
      }
    }
    const selectedItems = enrichQuoteItems(input.selectedItems, catalog, { checkIn: input.checkIn, checkOut: input.checkOut, source: "web" });
    // The hotel cannot host more people than the selected spaces allow: reject impossible requests early.
    const capacity = selectedItems.reduce((sum, item) => sum + (item.type === "accommodation" || item.type === "conference_room" || item.type === "event_hall" ? (catalog.find((entry) => entry.id === item.property_id)?.capacity || 0) * item.quantity : 0), 0);
    if (capacity > 0 && input.people > capacity) return Response.json({ error: `Le nombre de personnes (${input.people}) dépasse la capacité totale des espaces sélectionnés (${capacity}). Réduisez le nombre de personnes ou ajoutez des espaces.` }, { status: 400 });
    const linkedUserId = user?.id || await findActiveUserIdByEmail(input.guestEmail);
    const [created] = await db.insert(quoteRequests).values({ publicToken: randomBytes(28).toString("hex"), userId: linkedUserId, guestName: input.guestName, guestEmail: input.guestEmail, guestPhone: input.guestPhone, company: input.company, locale: input.locale, requestKind: input.requestKind, selectedItems, checkIn: input.checkIn || null, checkOut: input.checkOut || null, people: input.people, message: input.message, budget: input.budget ?? null, estimatedTotal: quoteTotal(selectedItems), pdfTemplateVersion: currentQuotePdfVersion(), status: "new" }).returning();
    const reference = `DEV-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}`;
    const [quote] = await db.update(quoteRequests).set({ reference }).where(eq(quoteRequests.id, created.id)).returning();
    const settings = await getSettings();
    const pdf = await buildQuotePdf(quote, settings, "receipt");
    await notifyAdmin("quote", `Nouveau devis ${reference}`, `${input.guestName} · ${input.requestKind}`, `/admin?section=devis&quote=${quote.id}`);
    await notifyUser(quote.userId, "quote", "Votre demande de devis a bien été reçue", reference, `/devis/suivi?token=${quote.publicToken}`);
    await logActivity("Demande de devis", "quote", quote.id, input.guestName, user?.id || null, reference);
    await sendQuoteReceivedEmails(quote, settings, pdf);
    return Response.json({ ok: true, reference, token: quote.publicToken, pdfUrl: `/api/quotes/${quote.publicToken}/pdf?kind=receipt` }, { status: 201 });
  } catch (error) {
    console.error("[Palacio] Quote error:", error);
    return Response.json({ error: parseError(error) }, { status: 400 });
  }
}
