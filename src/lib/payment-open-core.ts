export type OpenPaymentOutcome =
  | { kind: "opened"; url: string }
  | { kind: "conflict"; error: string }
  | { kind: "failed"; error: string };

export const PAYMENT_CONFLICT_ERROR = "Ce paiement a déjà été traité. Rafraîchissez la page de confirmation.";
export const PAYMENT_FAILURE_ERROR = "Impossible d'ouvrir le paiement. Contactez l'hôtel.";

/** Payment data a gateway adapter must return for a booking. */
export type OpenedPayment = { url: string; reference: string; amount: number; currency: string; displayValue?: string };

export type GatewayBooking = Pick<import("@/db/schema").Booking, "id" | "paymentMethod" | "paymentStatus" | "paymentRef">;

/** Booking payment statuses from which a retry may still open a checkout. */
export const RETRYABLE_PAYMENT_STATUSES = ["unpaid", "awaiting_payment", "pay_on_site"] as const;

export type OpenPaymentDeps = {
  expireSession: (sessionId: string | null | undefined) => Promise<void>;
  create: (booking: GatewayBooking, origin: string) => Promise<OpenedPayment>;
  persist: (bookingId: number, payment: OpenedPayment) => Promise<boolean>;
};

/**
 * Opens (or re-opens) the online payment flow for a booking without ever letting
 * two concurrent retries create two live charges.
 *
 * Guards, in order:
 *  1. The caller (route) has already rejected paid/cancelled/cash bookings.
 *  2. A concurrent retry is serialised by `persist`: only one caller can move a
 *     booking into "awaiting_payment" for its own session reference, so a
 *     duplicate POST cannot double-create a payable session.
 *  3. When retrying a card payment, any still-open Stripe checkout session is
 *     expired first so the guest can only pay the newest session.
 */
export async function openBookingPayment(booking: GatewayBooking, origin: string, deps: OpenPaymentDeps): Promise<OpenPaymentOutcome> {
  try {
    // Card retry: retire the previous checkout session before minting a new one
    // so the guest can never pay the stale session AND the new one.
    if (booking.paymentMethod === "card" && booking.paymentRef && booking.paymentStatus === "awaiting_payment") {
      await deps.expireSession(booking.paymentRef);
    }
    const payment = await deps.create(booking, origin);
    const saved = await deps.persist(booking.id, payment);
    if (!saved) return { kind: "conflict", error: PAYMENT_CONFLICT_ERROR };
    return { kind: "opened", url: payment.url };
  } catch (error) {
    console.error("[Palacio] Payment open:", error);
    return { kind: "failed", error: PAYMENT_FAILURE_ERROR };
  }
}
