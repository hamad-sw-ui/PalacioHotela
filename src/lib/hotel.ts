import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, bookings, catalogItems, contentPages, notifications, siteSettings, type CatalogItem, type ContentPage, type SelectedItem } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { daysBetween } from "@/lib/format";
import { quoteLineTotal as sharedQuoteLineTotal } from "@/lib/quote-pricing";
export { daysBetween, formatXaf, validDateRange } from "@/lib/format";

export async function getSettings() {
  try {
    await ensureSeeded();
    const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
    return settings;
  } catch (error) {
    // Keep the public shell viewable during local UI work when PostgreSQL is not running.
    // Mutating APIs still fail normally and production keeps the database as a requirement.
    if (process.env.NODE_ENV !== "development") throw error;
    console.warn("[Palacio] Database unavailable in development; using preview settings.");
    return {
      id: 1, hotelName: "Palacio Hotel", logoUrl: "", heroImage: "/images/palacio-hero.jpg",
      heroTitleFr: "Un séjour d’exception, à votre image.", heroTitleEn: "An exceptional stay, made for you.",
      heroSubtitleFr: "Au cœur de Douala, découvrez une adresse où l’élégance rencontre la chaleur de l’hospitalité.",
      heroSubtitleEn: "In the heart of Douala, discover a place where elegance meets the warmth of hospitality.",
      aboutFr: "Plus qu’un hôtel, une destination.", aboutEn: "More than a hotel, a destination.", aboutImage: "/images/palacio-dining.jpg",
      theme: "forest", email: "bonjour@palaciohotel.com", phone: "+237 6 99 00 00 00", whatsapp: "237699000000",
      addressFr: "Bonanjo, Douala, Cameroun", addressEn: "Bonanjo, Douala, Cameroon", latitude: 4.0511, longitude: 9.7679,
      acceptingQuotes: true, aiProvider: "auto", aiBaseUrl: "", aiModel: "", quoteSignatureUrl: "", quoteStampUrl: "", quoteSignerName: "", quoteSignerRole: "", quoteTermsFr: "", quoteTermsEn: "", updatedAt: new Date(),
    };
  }
}

const previewCatalog: CatalogItem[] = [
  { id: 1, slug: "chambre-deluxe", category: "accommodation", nameFr: "Chambre Deluxe", nameEn: "Deluxe Room", descriptionFr: "Une chambre élégante et confortable.", descriptionEn: "An elegant and comfortable room.", image: "/images/palacio-suite.jpg", price: 95000, pricingUnit: "night", capacity: 2, inventory: 8, amenitiesFr: [], amenitiesEn: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, slug: "salon-acacia", category: "conference_room", nameFr: "Salon Acacia", nameEn: "Acacia Conference Room", descriptionFr: "Un espace pour vos réunions.", descriptionEn: "A space for your meetings.", image: "/images/palacio-conference.jpg", price: 350000, pricingUnit: "day", capacity: 60, inventory: 1, amenitiesFr: [], amenitiesEn: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 3, slug: "spa-bien-etre", category: "service", nameFr: "Spa & bien-être", nameEn: "Spa & Wellness", descriptionFr: "Un moment de détente.", descriptionEn: "A moment of relaxation.", image: "/images/palacio-wellness.jpg", price: 45000, pricingUnit: "person", capacity: 2, inventory: 10, amenitiesFr: [], amenitiesEn: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 4, slug: "salle-des-etoiles", category: "event_hall", nameFr: "Salle des Étoiles", nameEn: "Starlight Event Hall", descriptionFr: "Une salle pour vos événements.", descriptionEn: "A space for your celebrations.", image: "/images/palacio-conference.jpg", price: 650000, pricingUnit: "day", capacity: 180, inventory: 1, amenitiesFr: [], amenitiesEn: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 5, slug: "table-palacio", category: "restaurant", nameFr: "La Table du Palacio", nameEn: "Palacio Dining", descriptionFr: "Cuisine de saison et saveurs locales.", descriptionEn: "Seasonal cuisine and local flavours.", image: "/images/palacio-dining.jpg", price: 32000, pricingUnit: "person", capacity: 2, inventory: 40, amenitiesFr: [], amenitiesEn: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date() },
];

const previewPages: ContentPage[] = [
  { id: 1, slug: "notre-histoire", titleFr: "L’esprit Palacio", titleEn: "The Palacio spirit", bodyFr: "Bienvenue dans un lieu où l’hospitalité a le sens du détail.\n\nAu cœur de Douala, le Palacio Hotel vous accueille dans un écrin de sérénité.", bodyEn: "Welcome to a place where hospitality lives in the details.\n\nIn the heart of Douala, Palacio Hotel welcomes you into a haven of serenity.", image: "/images/palacio-hero.jpg", published: true, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, slug: "confidentialite", titleFr: "Politique de confidentialité", titleEn: "Privacy policy", bodyFr: "Vos données personnelles sont utilisées uniquement pour traiter vos demandes de réservation, de devis et vos messages.", bodyEn: "Your personal data is used only to process your booking requests, quote requests and messages.", image: "/images/palacio-hero.jpg", published: true, createdAt: new Date(), updatedAt: new Date() },
];

export async function getPublicPage(slug: string) {
  try {
    await ensureSeeded();
    const [page] = await db.select().from(contentPages).where(and(eq(contentPages.slug, slug), eq(contentPages.published, true))).limit(1);
    return page;
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    return previewPages.find((page) => page.slug === slug);
  }
}

export async function getPublicCatalog() {
  try {
    await ensureSeeded();
    return await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.id);
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    console.warn("[Palacio] Catalog unavailable in development preview; using preview catalog.");
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

export async function notifyUser(userId: number | null | undefined, type: string, title: string, message: string, href: string) {
  if (!userId) return;
  await db.insert(notifications).values({ userId, type, title, message, href });
}
