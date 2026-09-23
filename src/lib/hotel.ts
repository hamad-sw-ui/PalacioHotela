import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, bookings, catalogItems, notifications, siteSettings, type CatalogItem, type SelectedItem } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { daysBetween } from "@/lib/format";
export { daysBetween, formatXaf, validDateRange } from "@/lib/format";

export async function getSettings() {
  await ensureSeeded();
  const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  return settings;
}

export async function getPublicCatalog() {
  await ensureSeeded();
  return db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.id);
}

export function bookingTotal(item: CatalogItem, start: string, end: string, quantity: number) {
  const units = item.pricingUnit === "night" || item.pricingUnit === "day" ? Math.max(1, daysBetween(start, end)) : 1;
  return item.price * quantity * units;
}

export function quoteLineTotal(item: SelectedItem) {
  const nights = item.nights || (item.check_in && item.check_out ? Math.max(1, daysBetween(item.check_in, item.check_out)) : 1);
  const units = item.type === "accommodation" ? nights : item.type === "restaurant" ? Math.max(1, item.dates?.length || 1) * Math.max(1, item.meal_types?.length || 1) : item.type === "conference_room" || item.type === "event_hall" ? Math.max(1, item.dates?.length || (item.check_in && item.check_out ? daysBetween(item.check_in, item.check_out) : 1)) : 1;
  return Math.max(0, item.price) * Math.max(1, item.quantity) * units;
}

export async function remainingAvailability(item: CatalogItem, start: string, end: string) {
  const [result] = await db.select({ reserved: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int` }).from(bookings).where(and(eq(bookings.itemId, item.id), lt(bookings.checkIn, end), gt(bookings.checkOut, start), inArray(bookings.status, ["pending", "confirmed", "checked_in"])));
  return Math.max(0, item.inventory - Number(result?.reserved || 0));
}

export async function logActivity(action: string, entity: string, entityId: number | null, actorName = "Site web", actorId: number | null = null, details = "") {
  await db.insert(activityLogs).values({ action, entity, entityId, actorName, actorId, details: details.slice(0, 1000) });
}

export async function notifyAdmin(type: string, title: string, message: string, href: string) {
  await db.insert(notifications).values({ type, title, message, href });
}
