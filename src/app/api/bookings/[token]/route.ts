import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { markBookingPaid } from "@/lib/payment-confirm";
import { stripeClient } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let [booking] = await db.select().from(bookings).where(eq(bookings.publicToken, token)).limit(1);
  if (!booking) return Response.json({ error: "Réservation introuvable." }, { status: 404 });
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (sessionId && booking.paymentMethod === "card" && booking.paymentRef === sessionId && booking.paymentStatus !== "paid" && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await stripeClient().checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" && session.amount_total === booking.total && session.currency === "xaf" && session.metadata?.bookingId === String(booking.id)) {
        await markBookingPaid(booking);
        [booking] = await db.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1);
      }
    } catch (error) { console.error("[Palacio] Stripe session verification:", error); }
  }
  return Response.json({ booking: { reference: booking.reference, itemName: booking.itemName, guestName: booking.guestName, checkIn: booking.checkIn, checkOut: booking.checkOut, guests: booking.guests, quantity: booking.quantity, total: booking.total, status: booking.status, paymentMethod: booking.paymentMethod, paymentStatus: booking.paymentStatus, locale: booking.locale } });
}
