import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { bookingTotal, demandConflict, getPublicCatalog, getSettings, logActivity, notifyAdmin, notifyUser, validDateRange, withCatalogLocks } from "@/lib/hotel";
import { sendBookingEmails } from "@/lib/mail";
import { createPayPalOrder, createStripeCheckout, paymentConfiguration } from "@/lib/payments";
import { bookingInput, parseError } from "@/lib/validation";
import { bookingAdminHref } from "@/lib/notification-links";

export async function POST(request: Request) {
  try {
    // A signed-in client never dictates its own contact details: the account's are used instead.
    const user = await getCurrentUser();
    const body = await request.json();
    const accountPhone = (user?.phone || "").trim();
    const merged = user ? { ...body, guestName: user.fullName, guestEmail: user.email, guestPhone: accountPhone.length >= 6 ? accountPhone : body.guestPhone } : body;
    const input = bookingInput.parse(merged);
    if (!validDateRange(input.checkIn, input.checkOut)) return Response.json({ error: "Dates invalides. Sélectionnez des dates futures cohérentes." }, { status: 400 });
    const item = (await getPublicCatalog()).find((record) => record.id === input.itemId);
    if (!item) return Response.json({ error: "Cet espace n'est plus disponible." }, { status: 404 });
    if (input.guests > item.capacity * input.quantity) return Response.json({ error: "Le nombre de personnes dépasse la capacité de cet espace." }, { status: 400 });
    const settings = await getSettings();
    const methods = paymentConfiguration(settings);
    if (input.paymentMethod === "card" && !methods.card || input.paymentMethod === "paypal" && !methods.paypal) return Response.json({ error: "Ce mode de paiement n'est pas encore configuré. Choisissez le paiement sur place." }, { status: 400 });
    const token = randomBytes(28).toString("hex");
    const total = bookingTotal(item, input.checkIn, input.checkOut, input.quantity);
    const created = await withCatalogLocks([item.id], async () => {
      const blocked = await demandConflict(item, [{ quantity: input.quantity, check_in: input.checkIn, check_out: input.checkOut }]);
      if (blocked) return null;
      const [row] = await db.insert(bookings).values({ publicToken: token, userId: user?.id || null, itemId: item.id, itemName: input.locale === "en" ? item.nameEn : item.nameFr, guestName: input.guestName, guestEmail: input.guestEmail, guestPhone: input.guestPhone, locale: input.locale, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, quantity: input.quantity, total, notes: input.notes, paymentMethod: input.paymentMethod, paymentStatus: input.paymentMethod === "cash" ? "pay_on_site" : "unpaid" }).returning();
      return row;
    });
    if (!created) return Response.json({ error: `${item.nameFr} n'est plus disponible pour cette quantité à ces dates.` }, { status: 409 });
    const reference = `RES-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}`;
    let [booking] = await db.update(bookings).set({ reference }).where(eq(bookings.id, created.id)).returning();
    let redirectUrl: string | undefined;
    let paymentError: string | undefined;
    if (input.paymentMethod !== "cash") {
      try {
        const payment = input.paymentMethod === "card" ? await createStripeCheckout(booking, new URL(request.url).origin) : await createPayPalOrder(booking, new URL(request.url).origin);
        [booking] = await db.update(bookings).set({ paymentRef: payment.reference, paymentAmount: payment.amount, paymentCurrency: payment.currency, paymentStatus: "awaiting_payment", updatedAt: new Date() }).where(eq(bookings.id, booking.id)).returning();
        redirectUrl = payment.url;
      } catch (error) {
        console.error("[Palacio] Payment initialization:", error);
        paymentError = "Le paiement en ligne n'a pas pu être initialisé. Votre demande est enregistrée ; contactez l'hôtel ou réessayez depuis la confirmation.";
      }
    }
    await notifyAdmin("booking", `Nouvelle réservation ${reference}`, `${input.guestName} · ${item.nameFr} · ${input.checkIn}`, bookingAdminHref(booking.id));
    await notifyUser(booking.userId, "booking", "Votre demande de réservation a bien été reçue", `${reference} · ${item.nameFr}`, `/reservation/confirmation?token=${booking.publicToken}`);
    await logActivity("Création de réservation", "booking", booking.id, input.guestName, user?.id || null, reference);
    await sendBookingEmails(booking, settings, new URL(request.url).origin);
    return Response.json({ ok: true, reference, token, redirectUrl, paymentError, total, status: booking.status }, { status: 201 });
  } catch (error) {
    console.error("[Palacio] Booking error:", error);
    return Response.json({ error: parseError(error) }, { status: 400 });
  }
}
