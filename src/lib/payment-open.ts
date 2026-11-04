import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, type Booking } from "@/db/schema";
import { createPayPalOrder, createStripeCheckout, expireOpenStripeSession } from "@/lib/payments";
import { openBookingPayment, RETRYABLE_PAYMENT_STATUSES, type GatewayBooking, type OpenedPayment } from "@/lib/payment-open-core";

export { openBookingPayment, PAYMENT_CONFLICT_ERROR, PAYMENT_FAILURE_ERROR, RETRYABLE_PAYMENT_STATUSES } from "@/lib/payment-open-core";
export type { OpenPaymentOutcome, OpenedPayment, GatewayBooking } from "@/lib/payment-open-core";

/**
 * DB-backed gateway adapters: the conditional UPDATE is the serialisation guard —
 * it only succeeds when the booking is still in a retryable payment state, so a
 * concurrent retry, a webhook, or an admin settlement always wins the race.
 */
async function persistPayment(bookingId: number, payment: OpenedPayment) {
  const [saved] = await db.update(bookings).set({
    paymentRef: payment.reference,
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency,
    paymentStatus: "awaiting_payment",
    updatedAt: new Date(),
  }).where(and(eq(bookings.id, bookingId), inArray(bookings.paymentStatus, [...RETRYABLE_PAYMENT_STATUSES]))).returning();
  return Boolean(saved);
}

export async function openBookingPaymentWithDb(booking: Booking, origin: string) {
  return openBookingPayment(booking, origin, {
    expireSession: expireOpenStripeSession,
    create: (booking.paymentMethod === "card"
      ? ((target: GatewayBooking, source: string) => createStripeCheckout(target as Booking, source))
      : ((target: GatewayBooking, source: string) => createPayPalOrder(target as Booking, source))),
    persist: persistPayment,
  });
}
