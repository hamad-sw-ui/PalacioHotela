import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quoteRequests, type SelectedItem } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getPublicCatalog, getSettings, logActivity, notifyAdmin, notifyUser, remainingAvailability, validDateRange } from "@/lib/hotel";
import { sendQuoteReceivedEmails } from "@/lib/mail";
import { buildQuotePdf } from "@/lib/pdf-quote";
import { parseError, quoteInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    // A signed-in client never dictates its own contact details: the account's are used instead.
    const user = await getCurrentUser();
    const raw = quoteInput.parse(await request.json());
    const input = user ? { ...raw, guestName: user.fullName, guestEmail: user.email, guestPhone: user.phone || raw.guestPhone, company: user.phone ? raw.company : raw.company } : raw;
    if ((input.checkIn || input.checkOut) && (!input.checkIn || !input.checkOut || !validDateRange(input.checkIn, input.checkOut))) return Response.json({ error: "Dates invalides / Invalid dates" }, { status: 400 });
    const catalog = await getPublicCatalog();
    const selectedItems: SelectedItem[] = [];
    for (const selected of input.selectedItems) {
      const item = catalog.find((entry) => entry.id === selected.property_id);
      if (!item) return Response.json({ error: "Un élément sélectionné n'est plus disponible." }, { status: 400 });
      const start = selected.check_in || input.checkIn || undefined;
      const end = selected.check_out || input.checkOut || undefined;
      if (start && end) {
        if (!validDateRange(start, end)) return Response.json({ error: "Les dates d'un élément sont invalides." }, { status: 400 });
        if (await remainingAvailability(item, start, end) < selected.quantity) return Response.json({ error: `${item.nameFr} n'est plus disponible à ces dates.` }, { status: 409 });
      }
      selectedItems.push({ property_id: item.id, type: item.category as SelectedItem["type"], name_fr: item.nameFr, name_en: item.nameEn, price: item.price, quantity: selected.quantity, ...(item.category === "accommodation" && start && end ? { nights: Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000)) } : {}), ...(start ? { check_in: start } : {}), ...(end ? { check_out: end } : {}), ...(selected.dates ? { dates: selected.dates } : {}), ...(selected.meal_types ? { meal_types: selected.meal_types } : {}), ...(selected.parent_id ? { parent_id: selected.parent_id } : {}), source: "web" });
    }
    // The hotel cannot host more people than the selected spaces allow: reject impossible requests early.
    const capacity = selectedItems.reduce((sum, item) => sum + (item.type === "accommodation" || item.type === "conference_room" || item.type === "event_hall" ? (catalog.find((entry) => entry.id === item.property_id)?.capacity || 0) * item.quantity : 0), 0);
    if (capacity > 0 && input.people > capacity) return Response.json({ error: `Le nombre de personnes (${input.people}) dépasse la capacité totale des espaces sélectionnés (${capacity}). Réduisez le nombre de personnes ou ajoutez des espaces.` }, { status: 400 });
    const [created] = await db.insert(quoteRequests).values({ publicToken: randomBytes(28).toString("hex"), userId: user?.id || null, guestName: input.guestName, guestEmail: input.guestEmail, guestPhone: input.guestPhone, company: input.company, locale: input.locale, requestKind: input.requestKind, selectedItems, checkIn: input.checkIn || null, checkOut: input.checkOut || null, people: input.people, message: input.message, budget: input.budget ?? null, status: "new" }).returning();
    const reference = `DEV-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}`;
    const [quote] = await db.update(quoteRequests).set({ reference }).where(eq(quoteRequests.id, created.id)).returning();
    const settings = await getSettings();
    const pdf = await buildQuotePdf(quote, settings, "receipt");
    await notifyAdmin("quote", `Nouveau devis ${reference}`, `${input.guestName} · ${input.requestKind}`, "/admin?section=devis");
    await notifyUser(quote.userId, "quote", "Votre demande de devis a bien été reçue", reference, `/devis/suivi?token=${quote.publicToken}`);
    await logActivity("Demande de devis", "quote", quote.id, input.guestName, user?.id || null, reference);
    await sendQuoteReceivedEmails(quote, settings, pdf);
    return Response.json({ ok: true, reference, token: quote.publicToken, pdfUrl: `/api/quotes/${quote.publicToken}/pdf?kind=receipt` }, { status: 201 });
  } catch (error) {
    console.error("[Palacio] Quote error:", error);
    return Response.json({ error: parseError(error) }, { status: 400 });
  }
}
