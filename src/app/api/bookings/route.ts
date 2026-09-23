import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { bookingTotal, getPublicCatalog, getSettings, logActivity, notifyAdmin, remainingAvailability, validDateRange } from "@/lib/hotel";
import { sendBookingEmails } from "@/lib/mail";
import { createPayPalOrder, createStripeCheckout, paymentConfiguration } from "@/lib/payments";
import { bookingInput, parseError } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = bookingInput.parse(await request.json());
    if (!validDateRange(input.checkIn, input.checkOut)) return Response.json({ error: "Dates invalides. Sélectionnez des dates futures cohérentes." }, { status: 400 });
    const item = (await getPublicCatalog()).find((record) => record.id === input.itemId);
    if (!item) return Response.json({ error: "Cet espace n'est plus disponible." }, { status: 404 });
    if (input.guests > item.capacity * input.quantity) return Response.json({ error: "Le nombre de personnes dépasse la capacité de cet espace." }, { status: 400 });
    const available = await remainingAvailability(item, input.checkIn, input.checkOut);
    if (input.quantity > available) return Response.json({ error: `Seulement ${available} unité(s) disponible(s) pour ces dates.` }, { status: 409 });
    const methods = paymentConfiguration();
    if (input.paymentMethod === "card" && !methods.card || input.paymentMethod === "paypal" && !methods.paypal) return Response.json({ error: "Ce mode de paiement n'est pas encore configuré. Choisissez le paiement sur place." }, { status: 400 });
    const user = await getCurrentUser();
    const token = randomBytes(28).toString("hex");
    const total = bookingTotal(item, input.checkIn, input.checkOut, input.quantity);
    const [created] = await db.insert(bookings).values({ publicToken: token, userId: user?.id || null, itemId: item.id, itemName: input.locale === "en" ? item.nameEn : item.nameFr, guestName: input.guestName, guestEmail: input.guestEmail, guestPhone: input.guestPhone, locale: input.locale, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, quantity: input.quantity, total, notes: input.notes, paymentMethod: input.paymentMethod, paymentStatus: input.paymentMethod === "cash" ? "pay_on_site" : "unpaid" }).returning();
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
    const settings = await getSettings();
    await notifyAdmin("booking", `Nouvelle réservation ${reference}`, `${input.guestName} · ${item.nameFr} · ${input.checkIn}`, "/admin?section=reservations");
    await logActivity("Création de réservation", "booking", booking.id, input.guestName, user?.id || null, reference);
    await sendBookingEmails(booking, settings);
    return Response.json({ ok: true, reference, token, redirectUrl, paymentError, total, status: booking.status }, { status: 201 });
  } catch (error) {
    console.error("[Palacio] Booking error:", error);
    return Response.json({ error: parseError(error) }, { status: 400 });
  }
}
