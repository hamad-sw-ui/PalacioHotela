import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSettings } from "@/lib/hotel";
import { markBookingPaid } from "@/lib/payment-confirm";
import { resolveStripeConfig, stripeClient, stripeSessionMatchesBooking } from "@/lib/payments";

export async function POST(request: Request) {
  const stripe = resolveStripeConfig(await getSettings());
  if (!stripe.webhookSecret || !stripe.secretKey) return Response.json({ error: "Webhook not configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });
  try {
    const event = stripeClient(stripe.secretKey).webhooks.constructEvent(await request.text(), signature, stripe.webhookSecret);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const id = Number(session.metadata?.bookingId);
      if (Number.isInteger(id) && id > 0 && session.payment_status === "paid") {
        const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
        if (booking && stripeSessionMatchesBooking(session, booking)) await markBookingPaid(booking);
      }
    }
    return Response.json({ received: true });
  } catch (error) { console.error("[Palacio] Stripe webhook:", error); return Response.json({ error: "Invalid webhook" }, { status: 400 }); }
}
