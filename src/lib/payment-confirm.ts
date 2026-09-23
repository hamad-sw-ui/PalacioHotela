import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, type Booking } from "@/db/schema";
import { getSettings, logActivity, notifyAdmin } from "@/lib/hotel";
import { sendHotelMail } from "@/lib/mail";

const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);

export async function markBookingPaid(booking: Booking) {
  if (booking.paymentStatus === "paid") return;
  await db.update(bookings).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(bookings.id, booking.id));
  await notifyAdmin("payment", `Paiement reçu · ${booking.reference}`, `${booking.guestName} · ${booking.total.toLocaleString("fr-FR")} XAF`, "/admin?section=reservations");
  await logActivity("Paiement confirmé", "booking", booking.id, booking.guestName, booking.userId, `${booking.paymentMethod} · ${booking.reference}`);
  const settings = await getSettings();
  const en = booking.locale === "en";
  await sendHotelMail(booking.guestEmail, en ? `Payment received · ${booking.reference}` : `Paiement reçu · ${booking.reference}`, `<div style="background:#f6f4ee;padding:35px;font-family:Arial,sans-serif;color:#1e3a30"><div style="max-width:580px;margin:auto;background:white;padding:40px"><div style="background:#1e3a30;color:white;padding:22px;font-family:Georgia,serif;font-size:26px">PALACIO HOTEL</div><h1 style="font-family:Georgia,serif;font-weight:normal">${en ? "Thank you for your payment" : "Merci pour votre paiement"}</h1><p>${en ? "Dear" : "Cher/chère"} ${booking.guestName},</p><p style="line-height:1.7">${en ? "Your payment has been received. Our team will confirm your booking shortly." : "Votre paiement a bien été reçu. Notre équipe confirmera votre réservation dans les meilleurs délais."}</p><p style="background:#f3f5f0;padding:18px">${safe(booking.reference || "")} · ${safe(booking.itemName)}<br><strong>${booking.total.toLocaleString("fr-FR")} XAF</strong></p><p>${en ? "See you soon at Palacio Hotel." : "À très bientôt au Palacio Hotel."}</p></div></div>`, settings);
}
