import { desc } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, bookings, catalogItems, contactMessages, contentPages, notifications, quoteRequests, users } from "@/db/schema";
import { getAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/hotel";
import { paymentConfiguration } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  const settings = await getSettings();
  const [allBookings, allQuotes, allCatalog, allPages, allUsers, allMessages, allNotifications, allActivity] = await Promise.all([
    db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(500),
    db.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt)).limit(500),
    db.select().from(catalogItems).orderBy(desc(catalogItems.id)),
    db.select().from(contentPages).orderBy(desc(contentPages.id)),
    db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone, country: users.country, role: users.role, locale: users.locale, active: users.active, createdAt: users.createdAt }).from(users).orderBy(desc(users.id)).limit(500),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(300),
    db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100),
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(300),
  ]);
  return Response.json({ admin: { id: admin.id, fullName: admin.fullName, role: admin.role, email: admin.email }, bookings: allBookings, quotes: allQuotes, catalog: allCatalog, pages: allPages, users: allUsers, messages: allMessages, notifications: allNotifications, activity: allActivity, settings, integrations: { ...paymentConfiguration(), smtp: Boolean(process.env.SMTP_HOST), aiApi: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY), demoLogin: !process.env.ADMIN_PASSWORD }, stats: { bookings: allBookings.length, pendingBookings: allBookings.filter((b) => b.status === "pending").length, quotes: allQuotes.length, newQuotes: allQuotes.filter((q) => q.status === "new").length, unread: allNotifications.filter((n) => !n.read).length, messages: allMessages.filter((m) => m.status === "new").length } });
}
