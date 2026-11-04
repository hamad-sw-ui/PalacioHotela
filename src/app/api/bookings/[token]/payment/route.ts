import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSettings } from "@/lib/hotel";
import { openBookingPaymentWithDb } from "@/lib/payment-open";
import { paymentConfiguration } from "@/lib/payments";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [booking] = await db.select().from(bookings).where(eq(bookings.publicToken, token)).limit(1);
  if (!booking) return Response.json({ error: "Réservation introuvable." }, { status: 404 });
  if (booking.paymentStatus === "paid" || booking.status === "cancelled" || booking.paymentMethod === "cash") return Response.json({ error: "Ce paiement n'est plus disponible." }, { status: 400 });
  const config = paymentConfiguration(await getSettings());
  if (booking.paymentMethod === "card" && !config.card || booking.paymentMethod === "paypal" && !config.paypal) return Response.json({ error: "Service de paiement non configuré." }, { status: 503 });
  const outcome = await openBookingPaymentWithDb(booking, new URL(request.url).origin);
  if (outcome.kind === "conflict") return Response.json({ error: outcome.error }, { status: 409 });
  if (outcome.kind === "failed") return Response.json({ error: outcome.error }, { status: 502 });
  return Response.json({ url: outcome.url });
}
