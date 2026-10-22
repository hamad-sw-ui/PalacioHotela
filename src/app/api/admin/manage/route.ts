import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, catalogItems, contactMessages, contentPages, notifications, quoteRequests, siteSettings, users } from "@/db/schema";
import { getAdminForMutation, hashPassword } from "@/lib/auth";
import { countryAccepted } from "@/lib/account-rules";
import { replyAccepted } from "@/lib/message-rules";
import { activityDetail, activityShouldBeWritten } from "@/lib/activity-links";
import { themedEmailHtml, emailLogoDelivery } from "@/lib/email-theme";
import { hexColor, mergePalette, paletteIsCustom, paletteRoles, type QuotePdfPalette } from "@/lib/quote-pdf-theme";
import { coordinateValue } from "@/lib/geo";
import { afterBookingCancelled, bookingCanBeDeleted, onlinePayment, planOnlineRefund } from "@/lib/booking-refund";
import { assertCatalogCanBeRemoved, assertCatalogSlugAvailable, assertPageSlugAvailable, assertReservedPagesStay, assertUserEmailAvailable, assertUsersCanBeRemoved, bookingTotal, demandConflict, findActiveUserIdByEmail, getSettings, logActivity, notifyUser, occupiedInventory, remainingAvailability, validDateRange, withCatalogLocks } from "@/lib/hotel";
import { sendBookingEmails, sendBookingStateEmails, sendHotelMail, sendQuoteSentEmail, sendQuoteStateEmails } from "@/lib/mail";
import { buildQuotePdf } from "@/lib/pdf-quote";
import { safeBookingPdf } from "@/lib/payment-confirm";
import { quoteTotal } from "@/lib/quote-pricing";
import { enrichQuoteItems } from "@/lib/quote-items";
import { currentQuotePdfVersion } from "@/lib/quote-pdf-version";
import { saveSignatureImage } from "@/lib/signature-file";
import { bookingInput, contactInput, parseError, quoteInput } from "@/lib/validation";
import { quoteLogoUrl } from "@/lib/brand-logos";
import { settingsForBrowser } from "@/lib/smtp";
import { isValidGoogleClientId } from "@/lib/google-auth";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";
import { alignCatalogGallery, extraPhotos } from "@/lib/catalog-gallery";
import { normalizeCatalogFeatures, featuresForNewItem } from "@/lib/catalog-features";

const image = z.string().max(2000).refine((s) => !s || s.startsWith("/") || s.startsWith("https://"), "URL d'image invalide");
const quoteDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const quoteMeal = z.enum(["breakfast", "lunch", "dinner", "snacks", "other"]);
const catalogSchema = z.object({ slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/), category: z.enum(["accommodation", "conference_room", "event_hall", "service", "restaurant"]), nameFr: z.string().min(2).max(200), nameEn: z.string().min(2).max(200), descriptionFr: z.string().max(4000), descriptionEn: z.string().max(4000), image, images: z.array(image).max(8).default([]), price: z.coerce.number().int().min(0).max(1000000000), pricingUnit: z.enum(["night", "day", "person", "service"]), capacity: z.coerce.number().int().min(1).max(10000), inventory: z.coerce.number().int().min(0).max(10000), amenitiesFr: z.array(z.string().max(100)).max(30), amenitiesEn: z.array(z.string().max(100)).max(30), features: z.array(z.object({ labelFr: z.string().max(40), labelEn: z.string().max(40), value: z.string().max(24) })).max(12).default([]), featured: z.boolean(), active: z.boolean() }).strict();
const pageSchema = z.object({ slug: z.string().min(2).max(160).regex(/^[a-z0-9-]+$/), titleFr: z.string().min(2).max(200), titleEn: z.string().min(2).max(200), bodyFr: z.string().max(30000), bodyEn: z.string().max(30000), image, published: z.boolean() }).strict();
const settingsSchema = z.object({ hotelName: z.string().min(2).max(180), logoUrl: image, secondaryLogoUrl: image, tertiaryLogoUrl: image, quoteLogoVariant: z.enum(["primary", "secondary", "tertiary"]), heroImage: image, heroTitleFr: z.string().min(3).max(300), heroTitleEn: z.string().min(3).max(300), heroSubtitleFr: z.string().max(1000), heroSubtitleEn: z.string().max(1000), aboutFr: z.string().max(5000), aboutEn: z.string().max(5000), aboutImage: image, pageHeroImage: image, galleryImage2: image, galleryImage3: image, fallbackImage: image, theme: z.enum(["forest", "midnight", "terracotta"]), themeColors: z.record(z.string(), z.string()).nullable(), email: z.email(), phone: z.string().min(6).max(60), whatsapp: z.string().min(8).max(60), instagramUrl: z.string().max(500).refine((value) => !value || value.startsWith("https://"), "Le lien Instagram doit commencer par https://"), facebookUrl: z.string().max(500).refine((value) => !value || value.startsWith("https://"), "Le lien Facebook doit commencer par https://"), addressFr: z.string().max(500), addressEn: z.string().max(500), latitude: z.union([z.number(), z.string()]).refine((value) => coordinateValue(value, -90, 90) !== null, "La latitude doit être comprise entre −90 et 90.").transform((value) => coordinateValue(value, -90, 90)!), longitude: z.union([z.number(), z.string()]).refine((value) => coordinateValue(value, -180, 180) !== null, "La longitude doit être comprise entre −180 et 180.").transform((value) => coordinateValue(value, -180, 180)!), acceptingQuotes: z.boolean(), aiProvider: z.enum(["auto", "openai", "ollama", "local", "gemini"]), aiBaseUrl: z.string().max(500), aiModel: z.string().max(120), aiApiKey: z.string().max(300).optional(), stripeSecretKey: z.string().max(500).optional(), stripeWebhookSecret: z.string().max(500).optional(), paypalClientId: z.string().max(300).optional(), paypalClientSecret: z.string().max(500).optional(), paypalEnv: z.enum(["sandbox", "live"]).optional(), paypalXafPerEur: z.coerce.number().min(0).max(10000).optional(), googleClientId: z.string().max(300).optional(), googleClientSecret: z.string().max(500).optional(), quoteSignatureUrl: image, quoteStampUrl: image, quoteHeaderImageUrl: image, quoteSignerName: z.string().max(180), quoteSignerRole: z.string().max(180), quoteTermsFr: z.string().max(10000), quoteTermsEn: z.string().max(10000), smtpHost: z.string().max(255), smtpPort: z.coerce.number().int().min(1).max(65535), smtpSecure: z.boolean(), smtpRequireTls: z.boolean(), smtpUser: z.string().max(255), smtpPassword: z.string().max(500).optional(), smtpFrom: z.string().max(500) }).strict();
const userSchema = z.object({ fullName: z.string().trim().min(2).max(180), email: z.email().transform((v) => v.toLowerCase()), country: z.string().trim().max(120).refine(countryAccepted, "Le pays doit contenir au moins 2 caractères.").optional(), phone: z.string().max(60).nullable(), role: z.enum(["admin", "staff", "guest"]), locale: z.enum(["fr", "en"]), active: z.boolean(), password: z.string().min(8).max(200).optional() }).strict();
const quoteSchema = z.object({ guestName: z.string().min(2).max(180), guestEmail: z.email(), guestPhone: z.string().min(6).max(60), company: z.string().max(180).nullable(), locale: z.enum(["fr", "en"]), requestKind: z.enum(["accommodation", "conference_room", "event_hall", "service", "restaurant", "mixed"]), checkIn: quoteDate.nullable(), checkOut: quoteDate.nullable(), people: z.coerce.number().int().min(1).max(10000), message: z.string().max(4000), budget: z.coerce.number().int().min(0).nullable(), estimatedTotal: z.coerce.number().int().min(0).nullable().optional(), amountTtc: z.coerce.number().int().min(0).nullable(), validUntil: quoteDate.nullable(), status: z.enum(["new", "in_review", "quote_sent", "negotiating", "accepted", "rejected", "expired", "cancelled"]), adminNotes: z.string().max(4000), selectedItems: z.array(z.object({ property_id: z.coerce.number().int().positive(), type: z.enum(["accommodation", "conference_room", "event_hall", "service", "restaurant"]), name_fr: z.string().max(200), name_en: z.string().max(200), description_fr: z.string().max(4000).optional(), description_en: z.string().max(4000).optional(), image: z.string().max(2000).optional(), price: z.coerce.number().int().min(0), quantity: z.coerce.number().int().min(1), nights: z.coerce.number().int().min(1).optional(), check_in: quoteDate.optional(), check_out: quoteDate.optional(), dates: z.array(quoteDate).max(30).optional(), order_date: quoteDate.optional(), order_dates: z.array(quoteDate).max(30).optional(), order_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), meal_types: z.array(quoteMeal).max(5).optional(), parent_id: z.coerce.number().int().positive().optional(), parent_item_name: z.string().max(200).optional(), source: z.string().optional() }).passthrough()).max(30) }).strict();
const bookingSchema = z.object({ guestName: z.string().min(2).max(180), guestEmail: z.email(), guestPhone: z.string().min(6).max(60), locale: z.enum(["fr", "en"]), itemId: z.coerce.number().int().positive(), checkIn: z.string(), checkOut: z.string(), guests: z.coerce.number().int().min(1).max(10000), quantity: z.coerce.number().int().min(1).max(100), notes: z.string().max(4000), status: z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"]), paymentStatus: z.enum(["unpaid", "awaiting_payment", "pay_on_site", "paid", "refunded"]), paymentMethod: z.enum(["cash", "card", "paypal"]) }).strict();

async function manageCatalog(action: string, id: number, data: Record<string, unknown>) {
  if (action === "delete") { await assertCatalogCanBeRemoved([id]); await db.delete(catalogItems).where(eq(catalogItems.id, id)); return {}; }
  if (action === "create") {
    const parsed = catalogSchema.parse({ descriptionFr: "", descriptionEn: "", image: "", price: 0, pricingUnit: "night", capacity: 2, inventory: 1, amenitiesFr: [], amenitiesEn: [], featured: false, active: true, ...data, features: featuresForNewItem(String(data.category || "accommodation"), data.features) });
    await assertCatalogSlugAvailable(parsed.slug);
    const [record] = await db.insert(catalogItems).values({ ...parsed, ...alignCatalogGallery(parsed.image, parsed.images) }).returning(); return record;
  }
  const parsed = catalogSchema.partial().parse({ ...data, ...(data.features !== undefined ? { features: normalizeCatalogFeatures(data.features) } : {}) });
  const gallery = parsed.image !== undefined && parsed.images !== undefined ? alignCatalogGallery(parsed.image, parsed.images) : parsed.image !== undefined ? { image: alignCatalogGallery(parsed.image, []).image } : parsed.images !== undefined ? { images: extraPhotos(parsed.images) } : {};
  if (parsed.slug) await assertCatalogSlugAvailable(parsed.slug, id);
  if (parsed.inventory !== undefined) {
    const occupied = await occupiedInventory(id);
    if (parsed.inventory < occupied) throw new Error(`Le stock ne peut pas passer sous ${occupied}, déjà occupé par des séjours ou des devis.`);
  }
  const [record] = await db.update(catalogItems).set({ ...parsed, ...gallery, updatedAt: new Date() }).where(eq(catalogItems.id, id)).returning();
  if (!record) throw new Error("Élément introuvable.");
  return record;
}

async function managePages(action: string, id: number, data: Record<string, unknown>) {
  if (action === "delete") { await assertReservedPagesStay([id], { remove: true }); await db.delete(contentPages).where(eq(contentPages.id, id)); return {}; }
  if (action === "create") {
    const parsed = pageSchema.parse({ bodyFr: "", bodyEn: "", image: "", published: true, ...data });
    await assertPageSlugAvailable(parsed.slug);
    const [record] = await db.insert(contentPages).values(parsed).returning();
    return record;
  }
  const parsed = pageSchema.partial().parse(data);
  if (parsed.slug) await assertPageSlugAvailable(parsed.slug, id);
  await assertReservedPagesStay([id], { slug: parsed.slug, published: parsed.published });
  const [record] = await db.update(contentPages).set({ ...parsed, updatedAt: new Date() }).where(eq(contentPages.id, id)).returning();
  if (!record) throw new Error("Page introuvable."); return record;
}

async function manageUsers(action: string, id: number, data: Record<string, unknown>, adminId: number) {
  if (action === "delete") {
    if (id === adminId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    await assertUsersCanBeRemoved([id]);
    await db.delete(users).where(eq(users.id, id)); return {};
  }
  if (action === "create") {
    const parsed = userSchema.parse({ country: "Non renseigné", phone: null, active: true, locale: "fr", role: "guest", ...data });
    if (!parsed.password) throw new Error("Un mot de passe d'au moins 8 caractères est requis.");
    await assertUserEmailAvailable(parsed.email);
    const [record] = await db.insert(users).values({ fullName: parsed.fullName, email: parsed.email, country: parsed.country || "Non renseigné", phone: parsed.phone, role: parsed.role, locale: parsed.locale, active: parsed.active, passwordHash: hashPassword(parsed.password) }).returning();
    return { id: record.id, email: record.email };
  }
  const parsed = userSchema.partial().parse(data);
  if (parsed.email) await assertUserEmailAvailable(parsed.email, id);
  if (id === adminId && (parsed.active === false || parsed.role && parsed.role !== "admin")) throw new Error("Vous ne pouvez pas désactiver ou rétrograder votre compte administrateur.");
  const { password, ...fields } = parsed;
  const [record] = await db.update(users).set({ ...fields, ...(password ? { passwordHash: hashPassword(password) } : {}) }).where(eq(users.id, id)).returning();
  if (!record) throw new Error("Utilisateur introuvable."); return { id: record.id, email: record.email };
}

async function manageBookings(action: string, id: number, data: Record<string, unknown>, origin = "") {
  if (action === "delete") {
    const [current] = await db.select().from(bookings).where(eq(bookings.id, id));
    if (current && !bookingCanBeDeleted(current)) throw new Error("Remboursez le paiement en ligne avant de supprimer cette réservation.");
    await db.delete(bookings).where(eq(bookings.id, id));
    return {};
  }
  if (action === "create") {
    const input = bookingInput.parse({ paymentMethod: "cash", locale: "fr", quantity: 1, guests: 1, notes: "", ...data });
    const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, input.itemId));
    if (!item || !validDateRange(input.checkIn, input.checkOut)) throw new Error("Espace ou dates invalides.");
    const created = await withCatalogLocks([item.id], async () => {
      const blocked = await demandConflict(item, [{ quantity: input.quantity, check_in: input.checkIn, check_out: input.checkOut }]);
      if (blocked) throw new Error("Disponibilité insuffisante.");
      const [row] = await db.insert(bookings).values({ publicToken: randomBytes(28).toString("hex"), itemId: item.id, itemName: input.locale === "en" ? item.nameEn : item.nameFr, guestName: input.guestName, guestEmail: input.guestEmail, guestPhone: input.guestPhone, locale: input.locale, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, quantity: input.quantity, notes: input.notes, total: bookingTotal(item, input.checkIn, input.checkOut, input.quantity), paymentMethod: input.paymentMethod, paymentStatus: "pay_on_site", status: "pending" }).returning();
      return row;
    });
    const [record] = await db.update(bookings).set({ reference: `RES-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}` }).where(eq(bookings.id, created.id)).returning();
    const adminSettings = await getSettings();
    await sendBookingEmails(record, adminSettings, origin, await safeBookingPdf(record, adminSettings, "receipt"));
    return record;
  }
  const [current] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!current) throw new Error("Réservation introuvable.");
  const refundConfirmed = data.refundConfirmed === true;
  const fields = { ...data };
  delete fields.refundConfirmed;
  const parsed = bookingSchema.partial().parse(fields);
  const itemId = parsed.itemId || current.itemId;
  const [item] = itemId ? await db.select().from(catalogItems).where(eq(catalogItems.id, itemId)) : [];
  if (!item) throw new Error("Espace introuvable.");
  const start = parsed.checkIn || current.checkIn;
  const end = parsed.checkOut || current.checkOut;
  const quantity = parsed.quantity || current.quantity;
  const guests = parsed.guests || current.guests;
  if (!validDateRange(start, end) && (parsed.checkIn || parsed.checkOut || parsed.itemId)) throw new Error("Dates invalides.");
  if (guests > item.capacity * quantity) throw new Error("Capacité insuffisante.");
  if (parsed.checkIn || parsed.checkOut || parsed.itemId || parsed.quantity) {
    const free = await remainingAvailability(item, start, end, { excludeBookingId: current.status === "cancelled" ? undefined : current.id });
    if (quantity > free) throw new Error("Disponibilité insuffisante.");
  }
  const nextStatus = parsed.status || current.status;
  const activeStatuses = new Set(["pending", "confirmed", "checked_in"]);
  const restoringAvailability = activeStatuses.has(nextStatus) && !activeStatuses.has(current.status);
  const plan = planOnlineRefund(current, { nextStatus, refundConfirmed: refundConfirmed || parsed.paymentStatus === "refunded" });
  if (parsed.paymentStatus === "refunded" && onlinePayment(current.paymentMethod) && current.paymentStatus !== "refunded" && plan !== "refund") throw new Error("Annulez la réservation pour rembourser un paiement carte ou PayPal.");
  const patch = { ...parsed };
  if (plan === "refund" || plan === "manual") { delete patch.paymentMethod; delete patch.paymentStatus; }
  const saveBooking = async () => {
    if (restoringAvailability) {
      if (!validDateRange(start, end)) throw new Error("Dates invalides pour réactiver cette réservation.");
      const free = await remainingAvailability(item, start, end);
      if (quantity > free) throw new Error("Disponibilité insuffisante pour réactiver cette réservation.");
    }
    const [saved] = await db.update(bookings).set({ ...patch, itemName: (parsed.locale || current.locale) === "en" ? item.nameEn : item.nameFr, total: bookingTotal(item, start, end, quantity), updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
    return saved;
  };
  const record = restoringAvailability ? await withCatalogLocks([item.id], saveBooking) : await saveBooking();
  const bookingNotices: Record<string, string> = { confirmed: "Votre réservation est confirmée", cancelled: "Votre réservation a été annulée", checked_in: "Votre séjour a commencé", checked_out: "Votre séjour est terminé" };
  if (parsed.status === "cancelled" && current.status !== "cancelled") return afterBookingCancelled(current, record, { actor: "hotel", origin, refundConfirmed: plan === "refund" });
  if (plan === "refund" && current.status === "cancelled") return afterBookingCancelled(current, record, { actor: "hotel", origin, refundConfirmed: true });
  if (parsed.status && parsed.status !== current.status && bookingNotices[parsed.status]) {
    const adminSettings = await getSettings();
    await sendBookingStateEmails(record, adminSettings, parsed.status, origin, undefined, parsed.status === "confirmed" ? await safeBookingPdf(record, adminSettings, "confirmation") : undefined);
    await notifyUser(record.userId, "booking", bookingNotices[parsed.status], record.reference || "", `/reservation/confirmation?token=${record.publicToken}`);
  }
  return record;
}

async function manageBulk(resource: string, data: Record<string, unknown>, adminId: number, origin = "") {
  const ids = z.array(z.coerce.number().int().positive()).min(1).max(500).parse(data.ids);
  const operation = z.string().trim().min(1).max(40).parse(data.operation);
  const value = data.value;
  const boolValue = () => z.boolean().parse(value);
  if (resource === "bookings") {
    if (operation === "set_status") {
      const status = z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"]).parse(value);
      const selectedBookings = await db.select().from(bookings).where(inArray(bookings.id, ids));
      const activeStatuses = new Set(["pending", "confirmed", "checked_in"]);
      const restored: { itemId: number; checkIn: string; checkOut: string; quantity: number }[] = [];
      if (activeStatuses.has(status)) {
        for (const booking of selectedBookings) {
          if (activeStatuses.has(booking.status)) continue;
          if (!booking.itemId || !validDateRange(booking.checkIn, booking.checkOut)) throw new Error(`Réservation ${booking.reference || `#${booking.id}`} invalide ou sans prestation.`);
          const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, booking.itemId));
          if (!item || booking.guests > item.capacity * booking.quantity) throw new Error(`Capacité insuffisante pour ${booking.reference || `#${booking.id}`}.`);
          const alreadyRestored = restored.filter((entry) => entry.itemId === booking.itemId && entry.checkIn < booking.checkOut && entry.checkOut > booking.checkIn).reduce((sum, entry) => sum + entry.quantity, 0);
          if (booking.quantity + alreadyRestored > await remainingAvailability(item, booking.checkIn, booking.checkOut)) throw new Error(`Disponibilité insuffisante pour ${booking.reference || `#${booking.id}`}.`);
          restored.push({ itemId: booking.itemId, checkIn: booking.checkIn, checkOut: booking.checkOut, quantity: booking.quantity });
        }
      }
      const rows = await db.update(bookings).set({ status, updatedAt: new Date() }).where(inArray(bookings.id, ids)).returning();
      let emailFailures = 0;
      const bookingNotices: Record<string, string> = { confirmed: "Votre réservation est confirmée", cancelled: "Votre réservation a été annulée", checked_in: "Votre séjour a commencé", checked_out: "Votre séjour est terminé" };
      if (bookingNotices[status]) {
        const settings = await getSettings();
        const outcomes = await Promise.allSettled(rows.map(async (record) => {
          const previous = selectedBookings.find((booking) => booking.id === record.id);
          if (status === "cancelled" && previous && previous.status !== "cancelled") { await afterBookingCancelled(previous, record, { actor: "hotel", origin }); return; }
          await sendBookingStateEmails(record, settings, status, origin);
          await notifyUser(record.userId, "booking", bookingNotices[status], record.reference || "", `/reservation/confirmation?token=${record.publicToken}`);
        }));
        emailFailures = outcomes.filter((outcome) => outcome.status === "rejected").length;
      }
      return { count: rows.length, ...(emailFailures ? { emailFailures } : {}) };
    }
    if (operation === "set_payment_status") {
      const paymentStatus = z.enum(["unpaid", "awaiting_payment", "pay_on_site", "paid", "refunded"]).parse(value);
      if (paymentStatus === "refunded") {
        const selected = await db.select().from(bookings).where(inArray(bookings.id, ids));
        if (selected.some((booking) => onlinePayment(booking.paymentMethod) && booking.paymentStatus === "paid")) throw new Error("Annulez la réservation pour rembourser un paiement carte ou PayPal.");
      }
      const rows = await db.update(bookings).set({ paymentStatus, updatedAt: new Date() }).where(inArray(bookings.id, ids)).returning({ id: bookings.id });
      return { count: rows.length };
    }
    if (operation === "delete") {
      const selected = await db.select().from(bookings).where(inArray(bookings.id, ids));
      const blocked = selected.find((booking) => !bookingCanBeDeleted(booking));
      if (blocked) throw new Error(`Remboursez ${blocked.reference || "la réservation"} avant de la supprimer.`);
      const rows = await db.delete(bookings).where(inArray(bookings.id, ids)).returning({ id: bookings.id });
      return { count: rows.length };
    }
  }
  if (resource === "quotes") {
    if (operation === "set_status") {
      const status = z.enum(["new", "in_review", "negotiating"]).parse(value);
      const rows = await db.update(quoteRequests).set({ status, updatedAt: new Date() }).where(inArray(quoteRequests.id, ids)).returning();
      let emailFailures = 0;
      const quoteNotices: Record<string, string> = { in_review: "Votre demande de devis est à l’étude", negotiating: "Votre devis est en discussion" };
      if (quoteNotices[status]) {
        const settings = await getSettings();
        const outcomes = await Promise.allSettled(rows.map(async (record) => {
          await sendQuoteStateEmails(record, settings, status, undefined, origin);
          await notifyUser(record.userId, "quote", quoteNotices[status], record.reference || "", `/devis/suivi?token=${record.publicToken}`);
        }));
        emailFailures = outcomes.filter((outcome) => outcome.status === "rejected").length;
      }
      return { count: rows.length, ...(emailFailures ? { emailFailures } : {}) };
    }
    if (operation === "delete") { const rows = await db.delete(quoteRequests).where(inArray(quoteRequests.id, ids)).returning({ id: quoteRequests.id }); return { count: rows.length }; }
  }
  if (resource === "catalog") {
    if (operation === "set_active") { const rows = await db.update(catalogItems).set({ active: boolValue(), updatedAt: new Date() }).where(inArray(catalogItems.id, ids)).returning({ id: catalogItems.id }); return { count: rows.length }; }
    if (operation === "set_featured") { const rows = await db.update(catalogItems).set({ featured: boolValue(), updatedAt: new Date() }).where(inArray(catalogItems.id, ids)).returning({ id: catalogItems.id }); return { count: rows.length }; }
    if (operation === "delete") { await assertCatalogCanBeRemoved(ids); const rows = await db.delete(catalogItems).where(inArray(catalogItems.id, ids)).returning({ id: catalogItems.id }); return { count: rows.length }; }
  }
  if (resource === "pages") {
    if (operation === "set_published") { const published = boolValue(); if (!published) await assertReservedPagesStay(ids, { published: false }); const rows = await db.update(contentPages).set({ published, updatedAt: new Date() }).where(inArray(contentPages.id, ids)).returning({ id: contentPages.id }); return { count: rows.length }; }
    if (operation === "delete") { await assertReservedPagesStay(ids, { remove: true }); const rows = await db.delete(contentPages).where(inArray(contentPages.id, ids)).returning({ id: contentPages.id }); return { count: rows.length }; }
  }
  if (resource === "users") {
    if (operation === "set_active") { if (ids.includes(adminId) && !boolValue()) throw new Error("Vous ne pouvez pas désactiver votre propre compte."); const rows = await db.update(users).set({ active: boolValue() }).where(inArray(users.id, ids)).returning({ id: users.id }); return { count: rows.length }; }
    if (operation === "delete") { if (ids.includes(adminId)) throw new Error("Vous ne pouvez pas supprimer votre propre compte."); await assertUsersCanBeRemoved(ids); const rows = await db.delete(users).where(inArray(users.id, ids)).returning({ id: users.id }); return { count: rows.length }; }
  }
  if (resource === "messages") {
    if (operation === "set_status") { const status = z.enum(["new", "read", "answered"]).parse(value); const rows = await db.update(contactMessages).set({ status }).where(inArray(contactMessages.id, ids)).returning({ id: contactMessages.id }); return { count: rows.length }; }
    if (operation === "delete") { const rows = await db.delete(contactMessages).where(inArray(contactMessages.id, ids)).returning({ id: contactMessages.id }); return { count: rows.length }; }
  }
  if (resource === "notifications") {
    if (operation === "read") { const rows = await db.update(notifications).set({ read: true }).where(and(inArray(notifications.id, ids), isNull(notifications.userId))).returning({ id: notifications.id }); return { count: rows.length }; }
    if (operation === "delete") { const rows = await db.delete(notifications).where(and(inArray(notifications.id, ids), isNull(notifications.userId))).returning({ id: notifications.id }); return { count: rows.length }; }
  }
  throw new Error("Action groupée non autorisée.");
}

async function manageQuotes(action: string, id: number, data: Record<string, unknown>, origin: string) {
  if (action === "delete") { await db.delete(quoteRequests).where(eq(quoteRequests.id, id)); return {}; }
  if (action === "create") {
    const input = quoteInput.parse({ selectedItems: [], locale: "fr", people: 1, message: "Demande créée depuis le backoffice.", ...data });
    const items = await db.select().from(catalogItems);
    const selectedItems = enrichQuoteItems(input.selectedItems, items, { checkIn: input.checkIn, checkOut: input.checkOut, source: "admin" });
    const groups = new Map<number, { item: (typeof items)[number]; lines: typeof selectedItems }>();
    for (const line of selectedItems) {
      const item = items.find((entry) => entry.id === line.property_id);
      if (!item) throw new Error("Un élément sélectionné n'est plus disponible.");
      const group = groups.get(item.id) || { item, lines: [] };
      group.lines.push(line);
      groups.set(item.id, group);
    }
    const created = await withCatalogLocks([...groups.keys()], async () => {
      for (const group of groups.values()) {
        const blocked = await demandConflict(group.item, group.lines, { start: input.checkIn, end: input.checkOut });
        if (blocked) throw new Error(`${blocked.nameFr} n'est plus disponible à ces dates.`);
      }
      const [row] = await db.insert(quoteRequests).values({ publicToken: randomBytes(28).toString("hex"), userId: await findActiveUserIdByEmail(input.guestEmail), guestName: input.guestName, guestEmail: input.guestEmail, guestPhone: input.guestPhone, company: input.company, locale: input.locale, requestKind: input.requestKind, selectedItems, checkIn: input.checkIn || null, checkOut: input.checkOut || null, people: input.people, message: input.message, budget: input.budget ?? null, estimatedTotal: quoteTotal(selectedItems), pdfTemplateVersion: currentQuotePdfVersion() }).returning();
      return row;
    });
    const [record] = await db.update(quoteRequests).set({ reference: `DEV-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}` }).where(eq(quoteRequests.id, created.id)).returning(); return record;
  }
  const [current] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id));
  if (!current) throw new Error("Devis introuvable.");
  if (action === "send") {
    const typedAmount = data.amountTtc === undefined || data.amountTtc === null || data.amountTtc === "" ? current.amountTtc : data.amountTtc;
    const amountTtc = typedAmount === undefined || typedAmount === null || typedAmount === "" ? Math.round(Number(current.estimatedTotal) || quoteTotal(current.selectedItems)) : Number(typedAmount);
    let validUntil = String(data.validUntil ?? current.validUntil ?? "").trim();
    if (!validUntil) { const date = new Date(); date.setDate(date.getDate() + 30); validUntil = date.toISOString().slice(0, 10); }
    if (!Number.isInteger(amountTtc) || amountTtc <= 0 || amountTtc > 1000000000 || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || validUntil < new Date().toISOString().slice(0, 10)) throw new Error("Renseignez un montant TTC positif et une date de validité future.");
    const adminNotes = data.adminNotes === undefined ? current.adminNotes : z.string().max(4000).parse(data.adminNotes);
    const sendGroups = new Map<number, typeof current.selectedItems>();
    for (const line of current.selectedItems) {
      const list = sendGroups.get(line.property_id) || [];
      list.push(line);
      sendGroups.set(line.property_id, list);
    }
    const settings = await getSettings();
    let signatureUrl = settings.quoteSignatureUrl;
    let signerName = settings.quoteSignerName;
    if (typeof data.signature === "string" && data.signature) {
      const saved = await saveSignatureImage(data.signature);
      signatureUrl = saved.url;
      signerName = z.string().trim().min(2).max(180).parse(data.signerName);
      if (data.rememberSignature === true) await db.update(siteSettings).set({ quoteSignatureUrl: signatureUrl, quoteSignerName: signerName, updatedAt: new Date() }).where(eq(siteSettings.id, 1));
    }
    const linkedUserId = current.userId || await findActiveUserIdByEmail(current.guestEmail);
    const record = await withCatalogLocks([...sendGroups.keys()], async () => {
      for (const [itemId, lines] of sendGroups) {
        const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, itemId)).limit(1);
        if (!item) continue;
        const blocked = await demandConflict(item, lines, { start: current.checkIn, end: current.checkOut }, { excludeQuoteId: current.id });
        if (blocked) throw new Error(`${lines[0]?.name_fr || blocked.nameFr} n'est plus disponible à ces dates.`);
      }
      const [row] = await db.update(quoteRequests).set({ userId: linkedUserId, amountTtc, validUntil, adminNotes, status: "quote_sent", adminSignatureUrl: signatureUrl || null, adminSignerName: signerName || null, adminSignerRole: settings.quoteSignerRole || null, adminSignedAt: signatureUrl ? new Date() : null, adminStampUrl: settings.quoteStampUrl || null, headerImageUrl: settings.quoteHeaderImageUrl || "", logoSnapshot: quoteLogoUrl(settings), tertiaryLogoSnapshot: settings.tertiaryLogoUrl || "", themeSnapshot: settings.theme || "forest", themePaletteSnapshot: mergePalette(settings.theme, settings.themeColors), termsSnapshotFr: settings.quoteTermsFr, termsSnapshotEn: settings.quoteTermsEn, pdfTemplateVersion: current.pdfTemplateVersion, updatedAt: new Date() }).where(eq(quoteRequests.id, id)).returning();
      return row;
    });
    const pdf = await buildQuotePdf(record, settings, "quote");
    const emailSent = await sendQuoteSentEmail(record, settings, pdf, `${origin}/devis/suivi?token=${record.publicToken}`);
    await notifyUser(record.userId, "quote", "Votre devis personnalisé est disponible", record.reference || "", `/devis/suivi?token=${record.publicToken}`);
    return { ...record, emailSent };
  }
  const parsed = quoteSchema.partial().parse(data);
  if (parsed.status === "quote_sent") throw new Error("Utilisez l'action Envoyer le devis pour notifier le client.");
  const updateData: Record<string, unknown> = { ...parsed, updatedAt: new Date() };
  if (parsed.guestEmail) updateData.userId = await findActiveUserIdByEmail(parsed.guestEmail);
  if (parsed.selectedItems) {
    const items = await db.select().from(catalogItems);
    const selectedItems = enrichQuoteItems(parsed.selectedItems, items, {
      checkIn: parsed.checkIn === undefined ? current.checkIn : parsed.checkIn,
      checkOut: parsed.checkOut === undefined ? current.checkOut : parsed.checkOut,
      source: "admin",
    });
    updateData.selectedItems = selectedItems;
    updateData.estimatedTotal = quoteTotal(selectedItems);
  }
  if (current.clientSignatureUrl && (parsed.selectedItems || parsed.amountTtc !== undefined || parsed.validUntil !== undefined || parsed.adminNotes !== undefined)) {
    updateData.clientSignatureUrl = null;
    updateData.clientSignerName = null;
    updateData.clientSignedAt = null;
    updateData.clientAcceptanceIp = null;
    updateData.clientAcceptanceUserAgent = null;
    if (current.status === "accepted") updateData.status = "negotiating";
  }
  const [record] = await db.update(quoteRequests).set(updateData).where(eq(quoteRequests.id, id)).returning();
  if (parsed.status && parsed.status !== current.status && ["in_review", "accepted", "rejected", "negotiating", "expired"].includes(parsed.status)) {
    await sendQuoteStateEmails(record, await getSettings(), parsed.status, undefined, origin);
    const titles: Record<string, string> = { in_review: "Votre demande de devis est à l’étude", accepted: "Votre devis a été accepté", rejected: "Votre devis a été refusé", negotiating: "Votre devis est en discussion", expired: "Votre devis a expiré" };
    await notifyUser(record.userId, "quote", titles[parsed.status] || "Mise à jour de votre devis", record.reference || "", `/devis/suivi?token=${record.publicToken}`);
  }
  return record;
}

export async function POST(request: Request) {
  const admin = await getAdminForMutation();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const body = await request.json() as { resource?: string; action?: string; id?: number; data?: Record<string, unknown> };
    const resource = body.resource || "";
    const action = body.action || "";
    const id = Number(body.id || 0);
    const data = body.data && typeof body.data === "object" ? body.data : {};
    if (!["catalog", "pages", "users", "bookings", "quotes", "settings", "messages", "notifications"].includes(resource) || !["create", "update", "delete", "send", "read", "read_all", "reply", "bulk"].includes(action)) return Response.json({ error: "Action inconnue." }, { status: 400 });
    if (admin.role !== "admin" && ["users", "settings"].includes(resource)) return Response.json({ error: "Droits administrateur requis." }, { status: 403 });
    if (!id && ["update", "delete", "send", "read", "reply"].includes(action)) return Response.json({ error: "Identifiant manquant." }, { status: 400 });
    let result: unknown = {};
    const origin = new URL(request.url).origin;
    if (action === "bulk") result = await manageBulk(resource, data, admin.id, origin);
    else if (resource === "catalog" && ["create", "update", "delete"].includes(action)) result = await manageCatalog(action, id, data);
    else if (resource === "pages" && ["create", "update", "delete"].includes(action)) result = await managePages(action, id, data);
    else if (resource === "users" && ["create", "update", "delete"].includes(action)) result = await manageUsers(action, id, data, admin.id);
    else if (resource === "bookings" && ["create", "update", "delete"].includes(action)) result = await manageBookings(action, id, data, origin);
    else if (resource === "quotes" && ["create", "update", "delete", "send"].includes(action)) result = await manageQuotes(action, id, data, new URL(request.url).origin);
    else if (resource === "settings" && action === "update") {
      const parsed = settingsSchema.partial().parse(data);
      const submittedGoogleId = parsed.googleClientId?.trim();
      if (submittedGoogleId && !isValidGoogleClientId(submittedGoogleId)) {
        const [current] = await db.select({ googleClientId: siteSettings.googleClientId }).from(siteSettings).where(eq(siteSettings.id, 1));
        if (submittedGoogleId !== current?.googleClientId?.trim()) {
          throw new Error("L’identifiant Google doit être l’identifiant brut se terminant par .apps.googleusercontent.com, sans https:// ni slash.");
        }
      }
      const submittedWhatsApp = parsed.whatsapp?.trim();
      if (submittedWhatsApp && !isValidWhatsAppNumber(submittedWhatsApp)) {
        const [current] = await db.select({ whatsapp: siteSettings.whatsapp }).from(siteSettings).where(eq(siteSettings.id, 1));
        if (submittedWhatsApp !== current?.whatsapp?.trim()) {
          throw new Error("Le numéro WhatsApp doit inclure l’indicatif pays et contenir 8 à 15 chiffres.");
        }
      }
      if ([parsed.logoUrl, parsed.secondaryLogoUrl, parsed.tertiaryLogoUrl].some((url) => url && /\.webp(?:$|\?)/i.test(url))) throw new Error("Les logos doivent être des PNG ou des JPEG.");
      let themeColors: QuotePdfPalette | null | undefined;
      if (parsed.themeColors !== undefined) {
        const [current] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
        const theme = parsed.theme ?? current?.theme ?? "forest";
        const incoming = parsed.themeColors;
        if (incoming) {
          for (const role of paletteRoles) {
            const value = incoming[role];
            if (typeof value === "string" && value.trim() && !hexColor(value)) throw new Error("Une couleur du thème est invalide.");
          }
        }
        themeColors = incoming && paletteIsCustom(theme, incoming) ? mergePalette(theme, incoming) : null;
      }
      const { themeColors: _incomingColors, smtpPassword, aiApiKey, stripeSecretKey, stripeWebhookSecret, paypalClientId, paypalClientSecret, googleClientId, googleClientSecret, ...settingsFields } = parsed;
      const storedAiKey = aiApiKey?.trim();
      const storedStripeKey = stripeSecretKey?.trim();
      const storedWebhook = stripeWebhookSecret?.trim();
      const storedPaypalId = paypalClientId?.trim();
      const storedPaypalSecret = paypalClientSecret?.trim();
      const storedGoogleId = googleClientId?.trim();
      const storedGoogleSecret = googleClientSecret?.trim();
      const [settings] = await db.update(siteSettings).set({ ...settingsFields, ...(smtpPassword ? { smtpPassword } : {}), ...(storedAiKey ? { aiApiKey: storedAiKey } : {}), ...(storedStripeKey ? { stripeSecretKey: storedStripeKey } : {}), ...(storedWebhook ? { stripeWebhookSecret: storedWebhook } : {}), ...(storedPaypalId ? { paypalClientId: storedPaypalId } : {}), ...(storedPaypalSecret ? { paypalClientSecret: storedPaypalSecret } : {}), ...(storedGoogleId ? { googleClientId: storedGoogleId } : {}), ...(storedGoogleSecret ? { googleClientSecret: storedGoogleSecret } : {}), ...(themeColors !== undefined ? { themeColors } : {}), updatedAt: new Date() }).where(eq(siteSettings.id, 1)).returning();
      if (!settings) throw new Error("Paramètres introuvables.");
      revalidatePath("/", "layout");
      result = settingsForBrowser(settings);
    } else if (resource === "messages") {
      if (action === "delete") { await db.delete(contactMessages).where(eq(contactMessages.id, id)); result = {}; }
      else if (action === "create") { const parsed = contactInput.parse(data); const [record] = await db.insert(contactMessages).values(parsed).returning(); result = record; }
      else if (action === "read") { const [record] = await db.update(contactMessages).set({ status: "read" }).where(and(eq(contactMessages.id, id), eq(contactMessages.status, "new"))).returning(); result = record ?? {}; }
      else if (action === "reply") {
        const reply = z.string().trim().refine(replyAccepted, "La réponse doit contenir entre 2 et 4000 caractères.").parse(data.reply);
        const [current] = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
        if (!current) throw new Error("Message introuvable.");
        const settings = await getSettings();
        const safe = (value: string) => value.replace(/[&<>"']/g, (v) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[v] || v);
        const emailSent = await sendHotelMail(current.email, `Réponse de ${settings.hotelName} · ${current.subject}`, themedEmailHtml(settings.theme, { eyebrow: "RÉPONSE", title: settings.hotelName, greeting: `Bonjour ${current.name},`, body: reply, detail: `<strong>${safe(current.subject)}</strong>`, footer: "Au sujet de votre message.", hotelName: settings.hotelName, address: settings.addressFr, phone: settings.phone, email: settings.email }, settings.themeColors, emailLogoDelivery(settings.logoUrl, origin)), settings);
        const [record] = await db.update(contactMessages).set({ reply, repliedAt: new Date(), status: "answered" }).where(eq(contactMessages.id, id)).returning();
        result = { ...record, emailSent };
      }
      else if (action === "update") { const parsed = contactInput.omit({ message: true }).partial().extend({ status: z.enum(["new", "read", "answered"]).optional() }).parse(data); const [record] = await db.update(contactMessages).set(parsed).where(eq(contactMessages.id, id)).returning(); result = record; }
    } else if (resource === "notifications") {
      if (action === "read_all") { await db.update(notifications).set({ read: true }).where(and(eq(notifications.read, false), isNull(notifications.userId))); result = {}; }
      else if (action === "read") { const [record] = await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, id), isNull(notifications.userId))).returning(); result = record; }
      else if (action === "delete") { await db.delete(notifications).where(and(eq(notifications.id, id), isNull(notifications.userId))); result = {}; }
    } else return Response.json({ error: "Action non autorisée pour cette section." }, { status: 400 });
    const record = result && typeof result === "object" ? result as Record<string, unknown> : null;
    if (activityShouldBeWritten(resource, action, data.quiet === true)) {
      await logActivity(`${action} ${resource}`, resource, id || (record && "id" in record ? Number(record.id) : null), admin.fullName, admin.id, activityDetail(resource, action, result));
    }
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error("[Palacio] Admin action:", error);
    return Response.json({ error: parseError(error) }, { status: 400 });
  }
}
