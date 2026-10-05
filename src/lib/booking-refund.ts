import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, type Booking } from "@/db/schema";
import { getSettings, logActivity, notifyAdmin, notifyUser } from "@/lib/hotel";
import { sendBookingCancellationEmails, sendBookingStateEmails, type CancellationOutcome } from "@/lib/mail";
import { bookingAdminHref } from "@/lib/notification-links";
import { bookingCanBeDeleted, onlinePayment, planOnlineRefund } from "@/lib/booking-refund-plan";
import { cardCheckoutCollected, expireOpenStripeSession, refundCollectedCharge } from "@/lib/payments";

export { bookingCanBeDeleted, onlinePayment, planOnlineRefund };

async function recordRefund(booking: Booking, actor: "guest" | "hotel") {
  const result = await refundCollectedCharge(booking);
  if (result.ok) {
    const [saved] = await db.update(bookings).set({ paymentStatus: "refunded", refundRef: result.refundRef || null, refundError: null, updatedAt: new Date() }).where(eq(bookings.id, booking.id)).returning();
    const record = saved || { ...booking, paymentStatus: "refunded", refundRef: result.refundRef, refundError: null };
    await notifyAdmin("payment", `Remboursement envoyé · ${record.reference}`, `${record.guestName} · ${record.paymentMethod === "card" ? "carte" : "PayPal"}`, bookingAdminHref(record.id));
    await logActivity("Remboursement envoyé", "booking", record.id, record.guestName, record.userId, `${record.paymentMethod} · ${result.refundRef}`);
    return { record, outcome: "refunded" as const };
  }
  const [saved] = await db.update(bookings).set({ refundError: result.error, updatedAt: new Date() }).where(eq(bookings.id, booking.id)).returning();
  const record = saved || { ...booking, refundError: result.error };
  await notifyAdmin("payment", `Remboursement à relancer · ${record.reference}`, result.error, bookingAdminHref(record.id));
  await logActivity(actor === "guest" ? "Remboursement client échoué" : "Remboursement échoué", "booking", record.id, record.guestName, record.userId, result.error);
  return { record, outcome: "failed" as const };
}

async function notifyCancellation(record: Booking, actor: "guest" | "hotel", outcome?: CancellationOutcome) {
  const detail = outcome === "refunded" ? "remboursement envoyé" : outcome === "failed" ? "remboursement à relancer" : outcome === "manual" ? "remboursement à confirmer" : "";
  await notifyUser(record.userId, "booking", "Votre réservation a été annulée", [record.reference || "", detail].filter(Boolean).join(" · "), `/reservation/confirmation?token=${record.publicToken}`);
  if (actor === "guest") {
    await notifyAdmin("booking", "Réservation annulée par le client", [record.reference || record.guestName, detail].filter(Boolean).join(" · "), bookingAdminHref(record.id));
    await logActivity("Réservation annulée par le client", "booking", record.id, record.guestName, record.userId, record.reference || "");
  }
}

export async function afterBookingCancelled(previous: Booking, updated: Booking, options: { actor: "guest" | "hotel"; origin?: string; refundConfirmed?: boolean }) {
  const origin = options.origin || "";
  if (previous.status === "cancelled" && !options.refundConfirmed) return updated;
  let source = previous;
  if (previous.status !== "cancelled" && previous.paymentMethod === "card" && previous.paymentStatus === "awaiting_payment" && previous.paymentRef) {
    if (await cardCheckoutCollected(previous.paymentRef)) {
      const [paid] = await db.update(bookings).set({ paymentStatus: "paid", updatedAt: new Date() }).where(and(eq(bookings.id, previous.id), eq(bookings.paymentStatus, "awaiting_payment"))).returning();
      if (paid) source = paid;
    } else await expireOpenStripeSession(previous.paymentRef);
    if (source === previous) {
      const [fresh] = await db.select().from(bookings).where(eq(bookings.id, previous.id)).limit(1);
      if (fresh && (fresh.paymentStatus === "paid" || fresh.paymentStatus === "refunded")) source = fresh;
    }
  }
  const plan = planOnlineRefund(source, { nextStatus: "cancelled", refundConfirmed: options.refundConfirmed || source.status !== previous.status && source.paymentStatus === "paid" && previous.paymentStatus !== "paid" });
  let record = updated;
  let outcome: CancellationOutcome | undefined;
  if (source.paymentStatus === "refunded") {
    outcome = "refunded";
    record = { ...updated, paymentStatus: source.paymentStatus, refundRef: source.refundRef, refundError: null };
  } else if (plan === "refund") {
    const settled = await recordRefund({ ...source, status: "cancelled" }, options.actor);
    record = { ...updated, ...settled.record, status: "cancelled" };
    outcome = settled.outcome;
  } else if (plan === "manual") outcome = "manual";
  const settings = await getSettings();
  if (options.actor === "guest" && previous.status !== "cancelled") await sendBookingCancellationEmails(record, settings, origin, outcome);
  else await sendBookingStateEmails(record, settings, "cancelled", origin, outcome);
  if (previous.status !== "cancelled") await notifyCancellation(record, options.actor, outcome);
  else if (outcome === "refunded") await notifyUser(record.userId, "payment", "Votre remboursement a été envoyé", record.reference || "", `/reservation/confirmation?token=${record.publicToken}`);
  return record;
}
