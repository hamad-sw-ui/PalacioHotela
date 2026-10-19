import { desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, bookings, catalogItems, contactMessages, contentPages, notifications, quoteRequests, users } from "@/db/schema";
import { getAdmin } from "@/lib/auth";
import { expireOverdueQuotes, getSettings } from "@/lib/hotel";
import { paymentConfiguration } from "@/lib/payments";
import { settingsForBrowser } from "@/lib/smtp";
import { googleAuthConfigured, googleEnvFromSettings } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  await expireOverdueQuotes().catch((error) => console.error("[Palacio] Auto-expire quotes:", error));
  const settings = await getSettings();
  const [allBookings, allQuotes, allCatalog, allPages, allUsers, allMessages, allNotifications, allActivity] = await Promise.all([
    db.select().from(bookings).orderBy(desc(bookings.createdAt)).limit(500),
    db.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt)).limit(500),
    db.select().from(catalogItems).orderBy(desc(catalogItems.id)),
    db.select().from(contentPages).orderBy(desc(contentPages.id)),
    db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone, country: users.country, role: users.role, locale: users.locale, active: users.active, createdAt: users.createdAt }).from(users).orderBy(desc(users.id)).limit(500),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(300),
    db.select().from(notifications).where(isNull(notifications.userId)).orderBy(desc(notifications.createdAt)).limit(100),
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(300),
  ]);
  const visibleSettings = settingsForBrowser(settings);
  return Response.json({ admin: { id: admin.id, fullName: admin.fullName, role: admin.role, email: admin.email }, bookings: allBookings, quotes: allQuotes, catalog: allCatalog, pages: allPages, users: allUsers, messages: allMessages, notifications: allNotifications, activity: allActivity, settings: visibleSettings, integrations: { ...paymentConfiguration(settings), google: googleAuthConfigured(googleEnvFromSettings(settings)), googleClientIdSet: Boolean(settings.googleClientId), googleClientSecretSet: Boolean(settings.googleClientSecret), smtp: Boolean(settings.smtpHost || process.env.SMTP_HOST), smtpPasswordSet: Boolean(settings.smtpPassword), aiApi: Boolean(settings.aiApiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY), aiApiKeySet: Boolean(settings.aiApiKey), stripeSecretKeySet: Boolean(settings.stripeSecretKey), stripeWebhookSecretSet: Boolean(settings.stripeWebhookSecret), paypalClientIdSet: Boolean(settings.paypalClientId), paypalClientSecretSet: Boolean(settings.paypalClientSecret), demoLogin: !process.env.ADMIN_PASSWORD }, stats: { bookings: allBookings.length, pendingBookings: allBookings.filter((b) => b.status === "pending").length, quotes: allQuotes.length, newQuotes: allQuotes.filter((q) => q.status === "new").length, unread: allNotifications.filter((n) => !n.read).length, messages: allMessages.filter((m) => m.status === "new").length } });
}
