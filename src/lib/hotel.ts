import { unstable_cache } from "next/cache";
import { cache } from "react";
import { and, eq, gt, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { activityLogs, bookings, catalogItems, contentPages, notifications, quoteRequests, siteSettings, users, type CatalogItem, type ContentPage, type SelectedItem } from "@/db/schema";
import { demandFits, demandRanges, occupiedPeak, quoteOccupiesStock, remainingFromStays, type Stay } from "@/lib/availability";
import { reservedPageChangeBlocked, reservedPageMessage } from "@/lib/content-pages";
import { ensureSeeded } from "@/lib/seed";
import { daysBetween } from "@/lib/format";
import { DEFAULT_ADDRESS_EN, DEFAULT_ADDRESS_FR, DEFAULT_HERO_SUBTITLE_EN, DEFAULT_HERO_SUBTITLE_FR, DEFAULT_TIME_ZONE, LOCATION_FALLBACKS } from "@/lib/location-copy";
import { quoteLineTotal as sharedQuoteLineTotal } from "@/lib/quote-pricing";
export { daysBetween, formatXaf, validDateRange } from "@/lib/format";

export async function getSettings() {
  await ensureSeeded();
  const getCachedSettings = unstable_cache(
    async () => {
      const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
      return settings;
    },
    ["site-settings"],
    { tags: ["settings"], revalidate: 60 },
  );
  try {
    return await getCachedSettings();
  } catch (error) {
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    // Keep the public shell viewable during local UI work when PostgreSQL is not running.
    // During the static prerender of `next build` (build machine without database access),
    // the same safe fallbacks allow the build to complete; pages rendered at runtime keep
    // the database as a requirement and fail loudly on outage.
    if (process.env.NODE_ENV !== "development" && !isBuildPhase) throw error;
    console.warn("[Palacio] Database unavailable; using preview settings (dev or build phase only).");
    return {
      id: 1, hotelName: "Palacio Hotel", logoUrl: "", secondaryLogoUrl: "", tertiaryLogoUrl: "", quoteLogoVariant: "primary", heroImage: "/images/palacio-hero.jpg",
      heroTitleFr: "Un séjour d’exception, à votre image.", heroTitleEn: "An exceptional stay, made for you.",
      heroSubtitleFr: DEFAULT_HERO_SUBTITLE_FR,
      heroSubtitleEn: DEFAULT_HERO_SUBTITLE_EN,
      aboutFr: "Plus qu’un hôtel, une destination.", aboutEn: "More than a hotel, a destination.", aboutImage: "/images/palacio-dining.jpg",
      pageHeroImage: "", galleryImage2: "", galleryImage3: "", fallbackImage: "",
      theme: "forest", themeColors: null, email: "bonjour@palaciohotel.com", phone: "+237 6 99 00 00 00", whatsapp: "237699000000", instagramUrl: "", facebookUrl: "",
      addressFr: "Bastos, Yaoundé, Cameroun", addressEn: "Bastos, Yaoundé, Cameroon", latitude: 4.0511, longitude: 9.7679,
      timeZone: DEFAULT_TIME_ZONE, cityFr: "Yaoundé", cityEn: "Yaounde", countryFr: "Cameroun", countryEn: "Cameroon", taglineFr: LOCATION_FALLBACKS.taglineFr, taglineEn: LOCATION_FALLBACKS.taglineEn, footerBaselineFr: LOCATION_FALLBACKS.footerBaselineFr, footerBaselineEn: LOCATION_FALLBACKS.footerBaselineEn,
      acceptingQuotes: true, aiProvider: "auto", aiBaseUrl: "", aiModel: "", aiApiKey: "", quoteSignatureUrl: "", quoteStampUrl: "", quoteHeaderImageUrl: "", quoteSignerName: "", quoteSignerRole: "", quoteTermsFr: "", quoteTermsEn: "", smtpHost: "", smtpPort: 587, smtpSecure: false, smtpRequireTls: true, smtpUser: "", smtpPassword: "", smtpFrom: "", stripeSecretKey: "", stripeWebhookSecret: "", paypalClientId: "", paypalClientSecret: "", paypalEnv: "sandbox", paypalXafPerEur: 655.957, googleClientId: "", googleClientSecret: "", updatedAt: new Date(),
    };
  }
}

const previewCatalog: CatalogItem[] = [
  { id: 1, slug: "chambre-deluxe", category: "accommodation", nameFr: "Chambre Deluxe", nameEn: "Deluxe Room", descriptionFr: "Une chambre élégante et confortable.", descriptionEn: "An elegant and comfortable room.", image: "/images/palacio-suite.jpg", price: 95000, pricingUnit: "night", capacity: 2, inventory: 8, amenitiesFr: [], amenitiesEn: [], images: [], features: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, slug: "salon-acacia", category: "conference_room", nameFr: "Salon Acacia", nameEn: "Acacia Conference Room", descriptionFr: "Un espace pour vos réunions.", descriptionEn: "A space for your meetings.", image: "/images/palacio-conference.jpg", price: 350000, pricingUnit: "day", capacity: 60, inventory: 1, amenitiesFr: [], amenitiesEn: [], images: [], features: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 3, slug: "spa-bien-etre", category: "service", nameFr: "Spa & bien-être", nameEn: "Spa & Wellness", descriptionFr: "Un moment de détente.", descriptionEn: "A moment of relaxation.", image: "/images/palacio-wellness.jpg", price: 45000, pricingUnit: "person", capacity: 2, inventory: 10, amenitiesFr: [], amenitiesEn: [], images: [], features: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 4, slug: "salle-des-etoiles", category: "event_hall", nameFr: "Salle des Étoiles", nameEn: "Starlight Event Hall", descriptionFr: "Une salle pour vos événements.", descriptionEn: "A space for your celebrations.", image: "/images/palacio-conference.jpg", price: 650000, pricingUnit: "day", capacity: 180, inventory: 1, amenitiesFr: [], amenitiesEn: [], images: [], features: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 5, slug: "table-palacio", category: "restaurant", nameFr: "La Table du Palacio", nameEn: "Palacio Dining", descriptionFr: "Cuisine de saison et saveurs locales.", descriptionEn: "Seasonal cuisine and local flavours.", image: "/images/palacio-dining.jpg", price: 32000, pricingUnit: "person", capacity: 2, inventory: 40, amenitiesFr: [], amenitiesEn: [], images: [], features: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
];

const previewPages: ContentPage[] = [
  { id: 1, slug: "notre-histoire", titleFr: "L’esprit Palacio", titleEn: "The Palacio spirit", bodyFr: `Bienvenue dans un lieu où l’hospitalité a le sens du détail.\n\nAu cœur de ${LOCATION_FALLBACKS.cityFr}, le Palacio Hotel vous accueille dans un écrin de sérénité.`, bodyEn: `Welcome to a place where hospitality lives in the details.\n\nIn the heart of ${LOCATION_FALLBACKS.cityEn}, Palacio Hotel welcomes you into a haven of serenity.`, image: "/images/palacio-hero.jpg", published: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, slug: "confidentialite", titleFr: "Politique de confidentialité", titleEn: "Privacy policy", bodyFr: "Vos données personnelles sont utilisées uniquement pour traiter vos demandes de réservation, de devis et vos messages.", bodyEn: "Your personal data is used only to process your booking requests, quote requests and messages.", image: "/images/palacio-hero.jpg", published: true, createdAt: new Date(), updatedAt: new Date() },
];

export async function getPublicPage(slug: string) {
  const cached = unstable_cache(
    async () => {
      await ensureSeeded();
      const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, slug), eq(contentPages.published, true))).limit(1);
      return page;
    },
    ["content-page", slug],
    { tags: ["pages", `page-${slug}`], revalidate: 60 },
  );
  try {
    return await cached();
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    return previewPages.find((page) => page.slug === slug);
  }
}

export async function getPublicCatalog() {
  const cached = unstable_cache(
    async () => await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.id),
    ["public-catalog"],
    { tags: ["catalog"], revalidate: 60 },
  );
  try {
    await ensureSeeded();
    return await cached();
  } catch (error) {
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (process.env.NODE_ENV !== "development" && !isBuildPhase) throw error;
    console.warn("[Palacio] Catalog unavailable; using preview catalog (dev or build phase only).");
    return previewCatalog;
  }
}

export function bookingTotal(item: CatalogItem, start: string, end: string, quantity: number) {
  const units = item.pricingUnit === "night" || item.pricingUnit === "day" ? Math.max(1, daysBetween(start, end)) : 1;
  return item.price * quantity * units;
}

export function quoteLineTotal(item: SelectedItem) {
  return sharedQuoteLineTotal(item);
}

async function occupyingStays(itemId: number, start: string, end: string, options: { excludeBookingId?: number; excludeQuoteId?: number } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const reserved = await db.select({ id: bookings.id, checkIn: bookings.checkIn, checkOut: bookings.checkOut, quantity: bookings.quantity }).from(bookings).where(and(eq(bookings.itemId, itemId), lt(bookings.checkIn, end), gt(bookings.checkOut, start), inArray(bookings.status, ["pending", "confirmed", "checked_in"])));
  // Filter in SQL instead of loading every active quote with its JSON payload:
  // quotes whose own stay window (or any explicit order date) cannot overlap the
  // requested window are excluded by the database, and expired holds are skipped.
  const holds = await db.select({ id: quoteRequests.id, status: quoteRequests.status, checkIn: quoteRequests.checkIn, checkOut: quoteRequests.checkOut, validUntil: quoteRequests.validUntil, selectedItems: quoteRequests.selectedItems }).from(quoteRequests).where(and(
    inArray(quoteRequests.status, ["new", "in_review", "quote_sent", "negotiating", "accepted"]),
    // The stay window (possibly null for order-date quotes) overlaps [start, end),
    // or the quote carries explicit dates stored in the selectedItems JSON.
    or(
      and(lt(quoteRequests.checkIn, end), gt(quoteRequests.checkOut, start)),
      isNull(quoteRequests.checkIn),
      sql`${quoteRequests.selectedItems}::text LIKE '%"order_date"%'`,
    ),
    // Non-accepted quotes only hold stock until their validity date.
    or(eq(quoteRequests.status, "accepted"), or(isNull(quoteRequests.validUntil), gte(quoteRequests.validUntil, today))),
  ));
  const stays: Stay[] = reserved.filter((booking) => booking.id !== options.excludeBookingId).map((booking) => ({ start: booking.checkIn, end: booking.checkOut, quantity: booking.quantity }));
  for (const quote of holds) {
    if (quote.id === options.excludeQuoteId || !quoteOccupiesStock(quote.status)) continue;
    if (quote.status !== "accepted" && quote.validUntil && quote.validUntil < today) continue;
    for (const line of quote.selectedItems) {
      if (line.property_id !== itemId) continue;
      stays.push(...demandRanges(line, { start: quote.checkIn, end: quote.checkOut }).map((range) => ({ ...range, quantity: line.quantity })));
    }
  }
  return stays;
}

export async function remainingAvailability(item: CatalogItem, start: string, end: string, options: { excludeBookingId?: number; excludeQuoteId?: number } = {}) {
  return remainingFromStays(item.inventory, start, end, await occupyingStays(item.id, start, end, options));
}

export async function occupiedInventory(itemId: number) {
  return occupiedPeak(await occupyingStays(itemId, "1970-01-01", "2999-12-31"));
}

const keptMessage = "Cette prestation est liée à des réservations ou des devis. Masquez-la pour la retirer du site.";

export async function assertCatalogCanBeRemoved(ids: number[]) {
  const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (!unique.length) return;
  const [linkedBooking] = await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.itemId, unique)).limit(1);
  if (linkedBooking) throw new Error(keptMessage);
  const quotes = await db.select({ selectedItems: quoteRequests.selectedItems }).from(quoteRequests);
  if (quotes.some((quote) => quote.selectedItems.some((line) => unique.includes(line.property_id)))) throw new Error(keptMessage);
}

const keptUserMessage = "Ce compte est lié à des réservations ou des devis. Désactivez-le pour couper l’accès tout en les conservant.";

export async function assertUserEmailAvailable(email: string, exceptId = 0) {
  const normalized = email.trim().toLowerCase();
  const [other] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${normalized}`).limit(1);
  if (other && other.id !== exceptId) throw new Error("Cet e-mail est déjà utilisé.");
}

export async function assertUsersCanBeRemoved(ids: number[]) {
  const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (!unique.length) return;
  const [linkedBooking] = await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.userId, unique)).limit(1);
  if (linkedBooking) throw new Error(keptUserMessage);
  const [linkedQuote] = await db.select({ id: quoteRequests.id }).from(quoteRequests).where(inArray(quoteRequests.userId, unique)).limit(1);
  if (linkedQuote) throw new Error(keptUserMessage);
}

export async function assertCatalogSlugAvailable(slug: string, exceptId = 0) {
  const [other] = await db.select({ id: catalogItems.id }).from(catalogItems).where(eq(catalogItems.slug, slug)).limit(1);
  if (other && other.id !== exceptId) throw new Error("Ce lien est déjà utilisé.");
}

export async function assertPageSlugAvailable(slug: string, exceptId = 0) {
  const [other] = await db.select({ id: contentPages.id }).from(contentPages).where(eq(contentPages.slug, slug)).limit(1);
  if (other && other.id !== exceptId) throw new Error("Ce lien est déjà utilisé.");
}

export async function assertReservedPagesStay(ids: number[], change: { remove?: boolean; slug?: string; published?: boolean } = {}) {
  const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (!unique.length) return;
  const rows = await db.select({ slug: contentPages.slug }).from(contentPages).where(inArray(contentPages.id, unique));
  if (rows.some((row) => reservedPageChangeBlocked(row.slug, change))) throw new Error(reservedPageMessage);
}

export async function withCatalogLocks<T>(itemIds: number[], run: () => Promise<T>) {
  const ids = [...new Set(itemIds)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
  if (!ids.length) return run();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Do not lock catalog rows with FOR UPDATE. The insert runs on another pooled
    // connection and its foreign key needs FOR KEY SHARE on the same row, so the
    // request would wait on a lock it already holds and never finish. Advisory
    // locks still serialize availability checks without blocking that insert.
    await client.query("SELECT pg_advisory_xact_lock(841394, id) FROM (SELECT id FROM unnest($1::int[]) AS id ORDER BY id) locked", [ids]);
    const result = await run();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function demandConflict(item: CatalogItem, lines: { quantity: number; order_dates?: string[]; order_date?: string; check_in?: string; check_out?: string }[], fallback?: { start?: string | null; end?: string | null }, options: { excludeBookingId?: number; excludeQuoteId?: number } = {}) {
  const incoming = lines.flatMap((line) => demandRanges(line, fallback).map((range) => ({ ...range, quantity: line.quantity })));
  if (!incoming.length) return null;
  const start = incoming.reduce((min, stay) => stay.start < min ? stay.start : min, incoming[0].start);
  const end = incoming.reduce((max, stay) => stay.end > max ? stay.end : max, incoming[0].end);
  const existing = await occupyingStays(item.id, start, end, options);
  return demandFits(item.inventory, incoming, existing) ? null : item;
}

export async function logActivity(action: string, entity: string, entityId: number | null, actorName = "Site web", actorId: number | null = null, details = "") {
  await db.insert(activityLogs).values({ action, entity, entityId, actorName, actorId, details: details.slice(0, 1000) });
}

export async function notifyAdmin(type: string, title: string, message: string, href: string) {
  await db.insert(notifications).values({ type, title, message, href });
}

export async function findActiveUserIdByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${normalized}`, eq(users.active, true))).limit(1);
  return user?.id ?? null;
}

export async function notifyUser(userId: number | null | undefined, type: string, title: string, message: string, href: string) {
  if (!userId) return;
  await db.insert(notifications).values({ userId, type, title, message, href });
}

/** Automatic quote lifecycle: mark overdue quotes as expired (idempotent).
 *  A quote is overdue when it has been sent (quote_sent or negotiating)
 *  and its validity date has passed. Returns the expired quotes. */
export async function expireOverdueQuotes() {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = await db.select({ id: quoteRequests.id, reference: quoteRequests.reference, guestName: quoteRequests.guestName, userId: quoteRequests.userId, publicToken: quoteRequests.publicToken }).from(quoteRequests)
    .where(and(inArray(quoteRequests.status, ["quote_sent", "negotiating"]), lt(quoteRequests.validUntil, today)));
  if (!overdue.length) return [];
  const ids = overdue.map((row) => row.id);
  const rows = await db.update(quoteRequests).set({ status: "expired", updatedAt: new Date() }).where(inArray(quoteRequests.id, ids)).returning({ id: quoteRequests.id, reference: quoteRequests.reference });
  for (const quote of rows) {
    await logActivity("Devis expiré automatiquement", "quote", quote.id, "Système", null, quote.reference || "");
    await notifyUser(overdue.find((row) => row.id === quote.id)?.userId, "quote", "Votre devis a expiré", quote.reference || "", `/devis/suivi?token=${overdue.find((row) => row.id === quote.id)?.publicToken || ""}`);
    await notifyAdmin("quote", `Devis expiré · ${quote.reference || ""}`, `Le devis de ${overdue.find((row) => row.id === quote.id)?.guestName || ""} a dépassé sa date de validité.`, `/admin?section=devis&quote=${quote.id}`);
  }
  return rows;
}
