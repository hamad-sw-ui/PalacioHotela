import { randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, catalogItems, contactMessages, contentPages, notifications, quoteRequests, siteSettings, users, type SelectedItem } from "@/db/schema";
import { getAdminForMutation, hashPassword } from "@/lib/auth";
import { bookingTotal, getSettings, logActivity, remainingAvailability, validDateRange } from "@/lib/hotel";
import { sendBookingEmails, sendQuoteSentEmail, sendStatusEmail } from "@/lib/mail";
import { buildQuotePdf } from "@/lib/pdf-quote";
import { bookingInput, contactInput, parseError, quoteInput } from "@/lib/validation";

const image = z.string().max(2000).refine((s) => !s || s.startsWith("/") || s.startsWith("https://"), "URL d'image invalide");
const catalogSchema = z.object({ slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/), category: z.enum(["accommodation", "conference_room", "event_hall", "service", "restaurant"]), nameFr: z.string().min(2).max(200), nameEn: z.string().min(2).max(200), descriptionFr: z.string().max(4000), descriptionEn: z.string().max(4000), image, price: z.coerce.number().int().min(0).max(1000000000), pricingUnit: z.enum(["night", "day", "person", "service"]), capacity: z.coerce.number().int().min(1).max(10000), inventory: z.coerce.number().int().min(0).max(10000), amenitiesFr: z.array(z.string().max(100)).max(30), amenitiesEn: z.array(z.string().max(100)).max(30), featured: z.boolean(), active: z.boolean() }).strict();
const pageSchema = z.object({ slug: z.string().min(2).max(160).regex(/^[a-z0-9-]+$/), titleFr: z.string().min(2).max(200), titleEn: z.string().min(2).max(200), bodyFr: z.string().max(30000), bodyEn: z.string().max(30000), image, published: z.boolean() }).strict();
const settingsSchema = z.object({ hotelName: z.string().min(2).max(180), logoUrl: image, heroImage: image, heroTitleFr: z.string().min(3).max(300), heroTitleEn: z.string().min(3).max(300), heroSubtitleFr: z.string().max(1000), heroSubtitleEn: z.string().max(1000), aboutFr: z.string().max(5000), aboutEn: z.string().max(5000), aboutImage: image, theme: z.enum(["forest", "midnight", "terracotta"]), email: z.email(), phone: z.string().min(6).max(60), whatsapp: z.string().min(8).max(60), addressFr: z.string().max(500), addressEn: z.string().max(500), latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180), acceptingQuotes: z.boolean(), aiProvider: z.enum(["auto", "openai", "ollama", "local"]), aiBaseUrl: z.string().max(500), aiModel: z.string().max(120) }).strict();
const userSchema = z.object({ fullName: z.string().trim().min(2).max(180), email: z.email().transform((v) => v.toLowerCase()), phone: z.string().max(60).nullable(), role: z.enum(["admin", "staff", "guest"]), locale: z.enum(["fr", "en"]), active: z.boolean(), password: z.string().min(8).max(200).optional() }).strict();
const quoteSchema = z.object({ guestName: z.string().min(2).max(180), guestEmail: z.email(), guestPhone: z.string().min(6).max(60), company: z.string().max(180).nullable(), locale: z.enum(["fr", "en"]), requestKind: z.enum(["accommodation", "conference_room", "event_hall", "service", "restaurant", "mixed"]), checkIn: z.string().nullable(), checkOut: z.string().nullable(), people: z.coerce.number().int().min(1).max(10000), message: z.string().max(4000), budget: z.coerce.number().int().min(0).nullable(), amountTtc: z.coerce.number().int().min(0).nullable(), validUntil: z.string().nullable(), status: z.enum(["new", "in_review", "quote_sent", "negotiating", "accepted", "rejected", "expired"]), adminNotes: z.string().max(4000), selectedItems: z.array(z.object({ property_id: z.coerce.number().int().positive(), type: z.enum(["accommodation", "conference_room", "event_hall", "service", "restaurant"]), name_fr: z.string().max(200), name_en: z.string().max(200), price: z.coerce.number().int().min(0), quantity: z.coerce.number().int().min(1), nights: z.coerce.number().int().min(1).optional(), check_in: z.string().optional(), check_out: z.string().optional(), dates: z.array(z.string()).optional(), meal_types: z.array(z.string()).optional(), source: z.string().optional() }).passthrough()).max(30) }).strict();
const bookingSchema = z.object({ guestName: z.string().min(2).max(180), guestEmail: z.email(), guestPhone: z.string().min(6).max(60), locale: z.enum(["fr", "en"]), itemId: z.coerce.number().int().positive(), checkIn: z.string(), checkOut: z.string(), guests: z.coerce.number().int().min(1).max(10000), quantity: z.coerce.number().int().min(1).max(100), notes: z.string().max(4000), status: z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"]), paymentStatus: z.enum(["unpaid", "awaiting_payment", "pay_on_site", "paid", "refunded"]), paymentMethod: z.enum(["cash", "card", "paypal"]) }).strict();

async function manageCatalog(action: string, id: number, data: Record<string, unknown>) {
  if (action === "delete") { await db.delete(catalogItems).where(eq(catalogItems.id, id)); return {}; }
  if (action === "create") {
    const parsed = catalogSchema.parse({ descriptionFr: "", descriptionEn: "", image: "", price: 0, pricingUnit: "night", capacity: 2, inventory: 1, amenitiesFr: [], amenitiesEn: [], featured: false, active: true, ...data });
    const [record] = await db.insert(catalogItems).values(parsed).returning(); return record;
  }
  const parsed = catalogSchema.partial().parse(data);
  const [record] = await db.update(catalogItems).set({ ...parsed, updatedAt: new Date() }).where(eq(catalogItems.id, id)).returning();
  if (!record) throw new Error("Élément introuvable.");
  return record;
}

async function managePages(action: string, id: number, data: Record<string, unknown>) {
  if (action === "delete") { await db.delete(contentPages).where(eq(contentPages.id, id)); return {}; }
  if (action === "create") { const parsed = pageSchema.parse({ bodyFr: "", bodyEn: "", image: "", published: true, ...data }); const [record] = await db.insert(contentPages).values(parsed).returning(); return record; }
  const parsed = pageSchema.partial().parse(data);
  const [record] = await db.update(contentPages).set({ ...parsed, updatedAt: new Date() }).where(eq(contentPages.id, id)).returning();
  if (!record) throw new Error("Page introuvable."); return record;
}

async function manageUsers(action: string, id: number, data: Record<string, unknown>, adminId: number) {
  if (action === "delete") {
    if (id === adminId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    await db.delete(users).where(eq(users.id, id)); return {};
  }
  if (action === "create") {
    const parsed = userSchema.parse({ phone: null, active: true, locale: "fr", role: "guest", ...data });
    if (!parsed.password) throw new Error("Un mot de passe d'au moins 8 caractères est requis.");
    const [record] = await db.insert(users).values({ fullName: parsed.fullName, email: parsed.email, phone: parsed.phone, role: parsed.role, locale: parsed.locale, active: parsed.active, passwordHash: hashPassword(parsed.password) }).returning();
    return { id: record.id, email: record.email };
  }
  const parsed = userSchema.partial().parse(data);
  if (id === adminId && (parsed.active === false || parsed.role && parsed.role !== "admin")) throw new Error("Vous ne pouvez pas désactiver ou rétrograder votre compte administrateur.");
  const { password, ...fields } = parsed;
  const [record] = await db.update(users).set({ ...fields, ...(password ? { passwordHash: hashPassword(password) } : {}) }).where(eq(users.id, id)).returning();
  if (!record) throw new Error("Utilisateur introuvable."); return { id: record.id, email: record.email };
}

async function manageBookings(action: string, id: number, data: Record<string, unknown>) {
  if (action === "delete") { await db.delete(bookings).where(eq(bookings.id, id)); return {}; }
  if (action === "create") {
    const input = bookingInput.parse({ paymentMethod: "cash", locale: "fr", quantity: 1, guests: 1, notes: "", ...data });
    const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, input.itemId));
    if (!item || !validDateRange(input.checkIn, input.checkOut)) throw new Error("Espace ou dates invalides.");
    if (input.quantity > await remainingAvailability(item, input.checkIn, input.checkOut)) throw new Error("Disponibilité insuffisante.");
    const [created] = await db.insert(bookings).values({ publicToken: randomBytes(28).toString("hex"), itemId: item.id, itemName: input.locale === "en" ? item.nameEn : item.nameFr, guestName: input.guestName, guestEmail: input.guestEmail, guestPhone: input.guestPhone, locale: input.locale, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, quantity: input.quantity, notes: input.notes, total: bookingTotal(item, input.checkIn, input.checkOut, input.quantity), paymentMethod: input.paymentMethod, paymentStatus: "pay_on_site", status: "pending" }).returning();
    const [record] = await db.update(bookings).set({ reference: `RES-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}` }).where(eq(bookings.id, created.id)).returning();
    await sendBookingEmails(record, await getSettings());
    return record;
  }
  const [current] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!current) throw new Error("Réservation introuvable.");
  const parsed = bookingSchema.partial().parse(data);
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
    const free = await remainingAvailability(item, start, end) + (item.id === current.itemId && current.status !== "cancelled" && current.checkIn < end && current.checkOut > start ? current.quantity : 0);
    if (quantity > free) throw new Error("Disponibilité insuffisante.");
  }
  const [record] = await db.update(bookings).set({ ...parsed, itemName: (parsed.locale || current.locale) === "en" ? item.nameEn : item.nameFr, total: bookingTotal(item, start, end, quantity), updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
  if (parsed.status && parsed.status !== current.status && ["confirmed", "cancelled"].includes(parsed.status)) await sendStatusEmail(record.guestEmail, record.guestName, record.reference || "", parsed.status, "booking", record.locale, await getSettings());
  return record;
}

async function manageQuotes(action: string, id: number, data: Record<string, unknown>, origin: string) {
  if (action === "delete") { await db.delete(quoteRequests).where(eq(quoteRequests.id, id)); return {}; }
  if (action === "create") {
    const input = quoteInput.parse({ selectedItems: [], locale: "fr", people: 1, message: "Demande créée depuis le backoffice.", ...data });
    const items = await db.select().from(catalogItems);
    const selectedItems: SelectedItem[] = input.selectedItems.map((line) => {
      const item = items.find((entry) => entry.id === line.property_id);
      if (!item) throw new Error("Une prestation sélectionnée est introuvable.");
      return { property_id: item.id, type: item.category as SelectedItem["type"], name_fr: item.nameFr, name_en: item.nameEn, price: item.price, quantity: line.quantity, ...(line.check_in ? { check_in: line.check_in } : {}), ...(line.check_out ? { check_out: line.check_out } : {}), ...(line.dates ? { dates: line.dates } : {}), ...(line.meal_types ? { meal_types: line.meal_types } : {}), source: "admin" };
    });
    const [created] = await db.insert(quoteRequests).values({ publicToken: randomBytes(28).toString("hex"), guestName: input.guestName, guestEmail: input.guestEmail, guestPhone: input.guestPhone, company: input.company, locale: input.locale, requestKind: input.requestKind, selectedItems, checkIn: input.checkIn || null, checkOut: input.checkOut || null, people: input.people, message: input.message, budget: input.budget ?? null }).returning();
    const [record] = await db.update(quoteRequests).set({ reference: `DEV-${new Date().getFullYear()}-${String(created.id).padStart(5, "0")}` }).where(eq(quoteRequests.id, created.id)).returning(); return record;
  }
  const [current] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id));
  if (!current) throw new Error("Devis introuvable.");
  if (action === "send") {
    const amountTtc = Number(data.amountTtc ?? current.amountTtc);
    const validUntil = String(data.validUntil ?? current.validUntil ?? "");
    if (!Number.isInteger(amountTtc) || amountTtc <= 0 || amountTtc > 1000000000 || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || validUntil < new Date().toISOString().slice(0, 10)) throw new Error("Renseignez un montant TTC positif et une date de validité future.");
    const adminNotes = data.adminNotes === undefined ? current.adminNotes : z.string().max(4000).parse(data.adminNotes);
    const [record] = await db.update(quoteRequests).set({ amountTtc, validUntil, adminNotes, status: "quote_sent", updatedAt: new Date() }).where(eq(quoteRequests.id, id)).returning();
    const settings = await getSettings();
    const pdf = await buildQuotePdf(record, settings, "quote");
    const emailSent = await sendQuoteSentEmail(record, settings, pdf, `${origin}/devis/suivi?token=${record.publicToken}`);
    return { ...record, emailSent };
  }
  const parsed = quoteSchema.partial().parse(data);
  if (parsed.status === "quote_sent") throw new Error("Utilisez l'action Envoyer le devis pour notifier le client.");
  const [record] = await db.update(quoteRequests).set({ ...parsed, ...(parsed.selectedItems ? { selectedItems: parsed.selectedItems as SelectedItem[] } : {}), updatedAt: new Date() }).where(eq(quoteRequests.id, id)).returning();
  if (parsed.status && parsed.status !== current.status && ["accepted", "rejected", "negotiating", "expired"].includes(parsed.status)) await sendStatusEmail(record.guestEmail, record.guestName, record.reference || "", parsed.status, "quote", record.locale, await getSettings());
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
    if (!["catalog", "pages", "users", "bookings", "quotes", "settings", "messages", "notifications"].includes(resource) || !["create", "update", "delete", "send", "read", "read_all"].includes(action)) return Response.json({ error: "Action inconnue." }, { status: 400 });
    if (admin.role !== "admin" && ["users", "settings"].includes(resource)) return Response.json({ error: "Droits administrateur requis." }, { status: 403 });
    if (!id && ["update", "delete", "send", "read"].includes(action)) return Response.json({ error: "Identifiant manquant." }, { status: 400 });
    let result: unknown = {};
    if (resource === "catalog" && ["create", "update", "delete"].includes(action)) result = await manageCatalog(action, id, data);
    else if (resource === "pages" && ["create", "update", "delete"].includes(action)) result = await managePages(action, id, data);
    else if (resource === "users" && ["create", "update", "delete"].includes(action)) result = await manageUsers(action, id, data, admin.id);
    else if (resource === "bookings" && ["create", "update", "delete"].includes(action)) result = await manageBookings(action, id, data);
    else if (resource === "quotes" && ["create", "update", "delete", "send"].includes(action)) result = await manageQuotes(action, id, data, new URL(request.url).origin);
    else if (resource === "settings" && action === "update") {
      const parsed = settingsSchema.partial().parse(data);
      const [settings] = await db.update(siteSettings).set({ ...parsed, updatedAt: new Date() }).where(eq(siteSettings.id, 1)).returning(); result = settings;
    } else if (resource === "messages") {
      if (action === "delete") { await db.delete(contactMessages).where(eq(contactMessages.id, id)); result = {}; }
      else if (action === "create") { const parsed = contactInput.parse(data); const [record] = await db.insert(contactMessages).values(parsed).returning(); result = record; }
      else if (action === "update") { const parsed = contactInput.partial().extend({ status: z.enum(["new", "read", "answered"]).optional() }).parse(data); const [record] = await db.update(contactMessages).set(parsed).where(eq(contactMessages.id, id)).returning(); result = record; }
    } else if (resource === "notifications") {
      if (action === "read_all") { await db.update(notifications).set({ read: true }).where(eq(notifications.read, false)); result = {}; }
      else if (action === "read") { const [record] = await db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).returning(); result = record; }
      else if (action === "delete") { await db.delete(notifications).where(eq(notifications.id, id)); result = {}; }
    } else return Response.json({ error: "Action non autorisée pour cette section." }, { status: 400 });
    await logActivity(`${action} ${resource}`, resource, id || (result && typeof result === "object" && "id" in result ? Number(result.id) : null), admin.fullName, admin.id);
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error("[Palacio] Admin action:", error);
    return Response.json({ error: parseError(error) }, { status: 400 });
  }
}
