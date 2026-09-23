import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, notifications, quoteRequests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const [myBookings, myQuotes, myNotifications] = await Promise.all([db.select().from(bookings).where(eq(bookings.userId, user.id)).orderBy(desc(bookings.createdAt)), db.select().from(quoteRequests).where(eq(quoteRequests.userId, user.id)).orderBy(desc(quoteRequests.createdAt)), db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(20)]);
  return Response.json({ user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, locale: user.locale }, bookings: myBookings.map((b) => ({ reference: b.reference, publicToken: b.publicToken, itemName: b.itemName, checkIn: b.checkIn, checkOut: b.checkOut, total: b.total, status: b.status, paymentStatus: b.paymentStatus })), notifications: myNotifications, unreadNotifications: myNotifications.filter((n) => !n.read).length, quotes: myQuotes.map((q) => ({ reference: q.reference, publicToken: q.publicToken, requestKind: q.requestKind, amountTtc: q.amountTtc, status: q.status, createdAt: q.createdAt })) });
}
