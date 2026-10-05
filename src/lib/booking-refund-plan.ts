type RefundBooking = { status: string; paymentMethod: string | null; paymentStatus: string | null };

export function onlinePayment(method: string | null | undefined) {
  return method === "card" || method === "paypal";
}

export type RefundPlan = "none" | "manual" | "refund";

/** Full online refund when a paid stay is cancelled before arrival. A started or finished stay needs an explicit confirmation. */
export function planOnlineRefund(booking: RefundBooking, input: { nextStatus?: string; refundConfirmed?: boolean } = {}): RefundPlan {
  if (!onlinePayment(booking.paymentMethod) || booking.paymentStatus !== "paid") return "none";
  const nextStatus = input.nextStatus ?? booking.status;
  if (nextStatus !== "cancelled") return "none";
  if (booking.status === "cancelled") return input.refundConfirmed ? "refund" : "none";
  if (booking.status === "checked_in" || booking.status === "checked_out") return input.refundConfirmed ? "refund" : "manual";
  if (booking.status === "pending" || booking.status === "confirmed") return "refund";
  return "none";
}

export function bookingCanBeDeleted(booking: RefundBooking) {
  return !(onlinePayment(booking.paymentMethod) && booking.paymentStatus === "paid");
}
