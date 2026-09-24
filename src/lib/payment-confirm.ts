import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, type Booking } from "@/db/schema";
import { getSettings, logActivity, notifyAdmin, notifyUser } from "@/lib/hotel";
import { sendBookingStateEmails } from "@/lib/mail";

export async function markBookingPaid(booking: Booking) {
  if (booking.paymentStatus === "paid") return;
  await db.update(bookings).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
  await notifyAdmin("payment", `Paiement reçu · ${booking.reference}`, `${booking.guestName} · ${booking.total.toLocaleString("fr-FR")} XAF`, "/admin?section=reservations");
  await notifyUser(booking.userId, "payment", "Votre paiement a été reçu", booking.reference || "", `/reservation/confirmation?token=${booking.publicToken}`);
  await logActivity("Paiement confirmé", "booking", booking.id, booking.guestName, booking.userId, `${booking.paymentMethod} · ${booking.reference}`);
  await sendBookingStateEmails({ ...booking, paymentStatus: "paid" }, await getSettings(), "paid");
}
