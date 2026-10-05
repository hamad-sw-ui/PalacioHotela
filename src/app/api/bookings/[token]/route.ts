import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { afterBookingCancelled } from "@/lib/booking-refund";
import { getSettings } from "@/lib/hotel";
import { markBookingPaid } from "@/lib/payment-confirm";
import { resolveStripeConfig, stripeClient, stripeSessionMatchesBooking } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let [booking] = await db.select().from(bookings).where(eq(bookings.publicToken, token)).limit(1);
  if (!booking) return Response.json({ error: "Réservation introuvable." }, { status: 404 });
  const sessionId = new URL(request.url).searchParams.get("session_id");
  const stripe = resolveStripeConfig(await getSettings());
  if (sessionId && booking.paymentMethod === "card" && booking.paymentRef === sessionId && booking.paymentStatus !== "paid" && booking.paymentStatus !== "refunded" && stripe.secretKey) {
    try {
      const session = await stripeClient(stripe.secretKey).checkout.sessions.retrieve(sessionId);
      if (stripeSessionMatchesBooking(session, booking)) {
        await markBookingPaid(booking);
        [booking] = await db.select().from(bookings).where(eq(bookings.id, booking.id)).limit(1);
      }
    } catch (error) { console.error("[Palacio] Stripe session verification:", error); }
  }
  return Response.json({ booking: { reference: booking.reference, itemName: booking.itemName, guestName: booking.guestName, checkIn: booking.checkIn, checkOut: booking.checkOut, guests: booking.guests, quantity: booking.quantity, total: booking.total, status: booking.status, paymentMethod: booking.paymentMethod, paymentStatus: booking.paymentStatus, locale: booking.locale } });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => ({})) as { action?: unknown };
  if (body.action !== "cancel") return Response.json({ error: "Action inconnue." }, { status: 400 });
  const [current] = await db.select().from(bookings).where(eq(bookings.publicToken, token)).limit(1);
  if (!current) return Response.json({ error: "Réservation introuvable." }, { status: 404 });
  if (!["pending", "confirmed"].includes(current.status)) return Response.json({ error: "Cette réservation ne peut plus être annulée." }, { status: 409 });
  const [record] = await db.update(bookings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, current.id)).returning();
  const settled = await afterBookingCancelled(current, record, { actor: "guest", origin: new URL(request.url).origin });
  return Response.json({ ok: true, status: settled.status, paymentStatus: settled.paymentStatus });
}
