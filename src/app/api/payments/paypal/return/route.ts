import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { markBookingPaid } from "@/lib/payment-confirm";
import { capturePayPalOrder } from "@/lib/payments";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("booking") || "";
  const paypalOrderId = url.searchParams.get("token") || "";
  const destination = new URL("/reservation/confirmation", url.origin);
  destination.searchParams.set("token", token);
  const [booking] = await db.select().from(bookings).where(eq(bookings.publicToken, token)).limit(1);
  if (!booking || booking.paymentMethod !== "paypal" || booking.paymentRef !== paypalOrderId || !booking.paymentAmount) return Response.redirect(new URL("/reservation?payment=invalid", url.origin), 303);
  if (booking.paymentStatus === "paid") return Response.redirect(destination, 303);
  try {
    const success = await capturePayPalOrder(paypalOrderId, booking.paymentAmount);
    if (success) await markBookingPaid(booking);
    else destination.searchParams.set("payment", "failed");
  } catch (error) { console.error("[Palacio] PayPal capture:", error); destination.searchParams.set("payment", "failed"); }
  return Response.redirect(destination, 303);
}
