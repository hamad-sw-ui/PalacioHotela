import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { bookings, type Booking } from "@/db/schema";
import { onlinePayment } from "@/lib/booking-refund";
import { getSettings, logActivity, notifyAdmin, notifyUser } from "@/lib/hotel";
import { sendBookingStateEmails } from "@/lib/mail";
import { bookingAdminHref } from "@/lib/notification-links";
import { refundCollectedCharge } from "@/lib/payments";

export async function markBookingPaid(booking: Booking) {
  const [locked] = await db.update(bookings).set({ paymentStatus: "paid", updatedAt: new Date() }).where(and(eq(bookings.id, booking.id), ne(bookings.paymentStatus, "paid"), ne(bookings.paymentStatus, "refunded"))).returning();
  if (!locked) return;
  if (locked.status === "cancelled" && onlinePayment(locked.paymentMethod)) {
    const result = await refundCollectedCharge(locked);
    const settings = await getSettings();
    if (result.ok) {
      const [saved] = await db.update(bookings).set({ paymentStatus: "refunded", refundRef: result.refundRef || null, refundError: null, updatedAt: new Date() }).where(eq(bookings.id, locked.id)).returning();
      const record = saved || { ...locked, paymentStatus: "refunded" as const, refundRef: result.refundRef, refundError: null };
      await notifyAdmin("payment", `Paiement remboursé · ${record.reference}`, `${record.guestName} · réservation déjà annulée`, bookingAdminHref(record.id));
      await notifyUser(record.userId, "payment", "Votre remboursement a été envoyé", record.reference || "", `/reservation/confirmation?token=${record.publicToken}`);
      await logActivity("Remboursement après annulation", "booking", record.id, record.guestName, record.userId, `${record.paymentMethod} · ${result.refundRef}`);
      await sendBookingStateEmails(record, settings, "cancelled", "", "refunded");
      return;
    }
    const [saved] = await db.update(bookings).set({ refundError: result.error, updatedAt: new Date() }).where(eq(bookings.id, locked.id)).returning();
    const record = saved || { ...locked, refundError: result.error };
    await notifyAdmin("payment", `Remboursement à relancer · ${record.reference}`, result.error, bookingAdminHref(record.id));
    await logActivity("Remboursement après annulation échoué", "booking", record.id, record.guestName, record.userId, result.error);
    await sendBookingStateEmails(record, settings, "cancelled", "", "failed");
    return;
  }
  await notifyAdmin("payment", `Paiement reçu · ${locked.reference}`, `${locked.guestName} · ${locked.total.toLocaleString("fr-FR")} XAF`, bookingAdminHref(locked.id));
  await notifyUser(locked.userId, "payment", "Votre paiement a été reçu", locked.reference || "", `/reservation/confirmation?token=${locked.publicToken}`);
  await logActivity("Paiement confirmé", "booking", locked.id, locked.guestName, locked.userId, `${locked.paymentMethod} · ${locked.reference}`);
  await sendBookingStateEmails(locked, await getSettings(), "paid");
}
