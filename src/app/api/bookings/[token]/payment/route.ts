import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { createPayPalOrder, createStripeCheckout, paymentConfiguration } from "@/lib/payments";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [booking] = await db.select().from(bookings).where(eq(bookings.publicToken, token)).limit(1);
  if (!booking) return Response.json({ error: "Réservation introuvable." }, { status: 404 });
  if (booking.paymentStatus === "paid" || booking.status === "cancelled" || booking.paymentMethod === "cash") return Response.json({ error: "Ce paiement n'est plus disponible." }, { status: 400 });
  const config = paymentConfiguration();
  if (booking.paymentMethod === "card" && !config.card || booking.paymentMethod === "paypal" && !config.paypal) return Response.json({ error: "Service de paiement non configuré." }, { status: 503 });
  try {
    const payment = booking.paymentMethod === "card" ? await createStripeCheckout(booking, new URL(request.url).origin) : await createPayPalOrder(booking, new URL(request.url).origin);
    await db.update(bookings).set({ paymentRef: payment.reference, paymentAmount: payment.amount, paymentCurrency: payment.currency, paymentStatus: "awaiting_payment", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
    return Response.json({ url: payment.url });
  } catch (error) { console.error("[Palacio] Payment retry:", error); return Response.json({ error: "Impossible d'ouvrir le paiement. Contactez l'hôtel." }, { status: 502 }); }
}
