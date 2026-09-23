import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { markBookingPaid } from "@/lib/payment-confirm";
import { stripeClient } from "@/lib/payments";

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) return Response.json({ error: "Webhook not configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });
  try {
    const event = stripeClient().webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const id = Number(session.metadata?.bookingId);
      if (Number.isInteger(id) && id > 0 && session.payment_status === "paid") {
        const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
        if (booking && booking.paymentMethod === "card" && booking.paymentRef === session.id && session.amount_total === booking.total && session.currency === "xaf") await markBookingPaid(booking);
      }
    }
    return Response.json({ received: true });
  } catch (error) { console.error("[Palacio] Stripe webhook:", error); return Response.json({ error: "Invalid webhook" }, { status: 400 }); }
}
