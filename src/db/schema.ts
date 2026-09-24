import { boolean, date, doublePrecision, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export type SelectedItem = {
  property_id: number;
  type: "accommodation" | "restaurant" | "conference_room" | "event_hall" | "service";
  name_fr: string;
  name_en: string;
  description_fr?: string;
  description_en?: string;
  image?: string;
  price: number;
  quantity: number;
  nights?: number;
  check_in?: string;
  check_out?: string;
  dates?: string[];
  order_date?: string;
  order_dates?: string[];
  order_time?: string;
  meal_types?: string[];
  parent_id?: number;
  parent_item_name?: string;
  source?: string;
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 180 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 60 }),
  country: varchar("country", { length: 120 }).notNull().default(""),
  passwordHash: text("password_hash"),
  role: varchar("role", { length: 20 }).notNull().default("guest"),
  locale: varchar("locale", { length: 2 }).notNull().default("fr"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_unique").on(t.email)]);

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  hotelName: varchar("hotel_name", { length: 180 }).notNull().default("Palacio Hotel"),
  logoUrl: text("logo_url").notNull().default(""),
  heroImage: text("hero_image").notNull().default("/images/palacio-hero.jpg"),
  heroTitleFr: text("hero_title_fr").notNull().default("Un séjour d’exception, à votre image."),
  heroTitleEn: text("hero_title_en").notNull().default("An exceptional stay, made for you."),
  heroSubtitleFr: text("hero_subtitle_fr").notNull().default("Au cœur de Douala, découvrez une adresse où l’élégance rencontre la chaleur de l’hospitalité."),
  heroSubtitleEn: text("hero_subtitle_en").notNull().default("In the heart of Douala, discover a place where elegance meets the warmth of hospitality."),
  aboutFr: text("about_fr").notNull().default("Plus qu’un hôtel, une destination. Chaque détail du Palacio est pensé pour faire de votre séjour un souvenir inoubliable."),
  aboutEn: text("about_en").notNull().default("More than a hotel, a destination. Every detail at Palacio is designed to make your stay unforgettable."),
  aboutImage: text("about_image").notNull().default("/images/palacio-dining.jpg"),
  theme: varchar("theme", { length: 24 }).notNull().default("forest"),
  email: varchar("email", { length: 255 }).notNull().default("bonjour@palaciohotel.com"),
  phone: varchar("phone", { length: 60 }).notNull().default("+237 6 99 00 00 00"),
  whatsapp: varchar("whatsapp", { length: 60 }).notNull().default("237699000000"),
  addressFr: text("address_fr").notNull().default("Bonanjo, Douala, Cameroun"),
  addressEn: text("address_en").notNull().default("Bonanjo, Douala, Cameroon"),
  latitude: doublePrecision("latitude").notNull().default(4.0511),
  longitude: doublePrecision("longitude").notNull().default(9.7679),
  acceptingQuotes: boolean("accepting_quotes").notNull().default(true),
  aiProvider: varchar("ai_provider", { length: 24 }).notNull().default("auto"),
  aiBaseUrl: text("ai_base_url").notNull().default(""),
  aiModel: varchar("ai_model", { length: 120 }).notNull().default(""),
  quoteSignatureUrl: text("quote_signature_url").notNull().default(""),
  quoteStampUrl: text("quote_stamp_url").notNull().default(""),
  quoteSignerName: varchar("quote_signer_name", { length: 180 }).notNull().default(""),
  quoteSignerRole: varchar("quote_signer_role", { length: 180 }).notNull().default(""),
  quoteTermsFr: text("quote_terms_fr").notNull().default(""),
  quoteTermsEn: text("quote_terms_en").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const catalogItems = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 200 }).notNull(),
  category: varchar("category", { length: 30 }).notNull(),
  nameFr: varchar("name_fr", { length: 200 }).notNull(),
  nameEn: varchar("name_en", { length: 200 }).notNull(),
  descriptionFr: text("description_fr").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  image: text("image").notNull().default(""),
  price: integer("price").notNull().default(0),
  pricingUnit: varchar("pricing_unit", { length: 24 }).notNull().default("night"),
  capacity: integer("capacity").notNull().default(2),
  inventory: integer("inventory").notNull().default(1),
  amenitiesFr: jsonb("amenities_fr").$type<string[]>().notNull().default([]),
  amenitiesEn: jsonb("amenities_en").$type<string[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("catalog_slug_unique").on(t.slug), index("catalog_category_idx").on(t.category)]);

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 30 }).unique(),
  publicToken: varchar("public_token", { length: 80 }).notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  itemId: integer("item_id").references(() => catalogItems.id, { onDelete: "set null" }),
  itemName: varchar("item_name", { length: 200 }).notNull(),
  guestName: varchar("guest_name", { length: 180 }).notNull(),
  guestEmail: varchar("guest_email", { length: 255 }).notNull(),
  guestPhone: varchar("guest_phone", { length: 60 }).notNull(),
  locale: varchar("locale", { length: 2 }).notNull().default("fr"),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  guests: integer("guests").notNull().default(1),
  quantity: integer("quantity").notNull().default(1),
  total: integer("total").notNull().default(0),
  notes: text("notes").notNull().default(""),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  paymentMethod: varchar("payment_method", { length: 24 }).notNull().default("cash"),
  paymentStatus: varchar("payment_status", { length: 24 }).notNull().default("unpaid"),
  paymentRef: text("payment_ref"),
  paymentAmount: integer("payment_amount"),
  paymentCurrency: varchar("payment_currency", { length: 8 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("bookings_dates_idx").on(t.itemId, t.checkIn, t.checkOut), index("bookings_email_idx").on(t.guestEmail)]);

export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 30 }).unique(),
  publicToken: varchar("public_token", { length: 80 }).notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  guestName: varchar("guest_name", { length: 180 }).notNull(),
  guestEmail: varchar("guest_email", { length: 255 }).notNull(),
  guestPhone: varchar("guest_phone", { length: 60 }).notNull(),
  company: varchar("company", { length: 180 }),
  locale: varchar("locale", { length: 2 }).notNull().default("fr"),
  requestKind: varchar("request_kind", { length: 32 }).notNull().default("accommodation"),
  selectedItems: jsonb("selected_items").$type<SelectedItem[]>().notNull().default([]),
  checkIn: date("check_in"),
  checkOut: date("check_out"),
  people: integer("people").notNull().default(1),
  message: text("message").notNull().default(""),
  budget: integer("budget"),
  estimatedTotal: integer("estimated_total"),
  amountTtc: integer("amount_ttc"),
  validUntil: date("valid_until"),
  status: varchar("status", { length: 24 }).notNull().default("new"),
  adminNotes: text("admin_notes").notNull().default(""),
  pdfTemplateVersion: integer("pdf_template_version").notNull().default(1),
  adminSignatureUrl: text("admin_signature_url"),
  adminSignerName: varchar("admin_signer_name", { length: 180 }),
  adminSignerRole: varchar("admin_signer_role", { length: 180 }),
  adminSignedAt: timestamp("admin_signed_at", { withTimezone: true }),
  adminStampUrl: text("admin_stamp_url"),
  clientSignatureUrl: text("client_signature_url"),
  clientSignerName: varchar("client_signer_name", { length: 180 }),
  clientSignedAt: timestamp("client_signed_at", { withTimezone: true }),
  clientAcceptanceIp: varchar("client_acceptance_ip", { length: 120 }),
  clientAcceptanceUserAgent: text("client_acceptance_user_agent"),
  termsSnapshotFr: text("terms_snapshot_fr").notNull().default(""),
  termsSnapshotEn: text("terms_snapshot_en").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("quotes_status_idx").on(t.status), index("quotes_email_idx").on(t.guestEmail)]);

export const contentPages = pgTable("content_pages", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull(),
  titleFr: varchar("title_fr", { length: 200 }).notNull(),
  titleEn: varchar("title_en", { length: 200 }).notNull(),
  bodyFr: text("body_fr").notNull().default(""),
  bodyEn: text("body_en").notNull().default(""),
  image: text("image").notNull().default(""),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("pages_slug_unique").on(t.slug)]);

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 60 }),
  subject: varchar("subject", { length: 240 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 24 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  href: text("href").notNull().default("/admin"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.read, t.createdAt)]);

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorName: varchar("actor_name", { length: 180 }).notNull().default("Système"),
  action: varchar("action", { length: 120 }).notNull(),
  entity: varchar("entity", { length: 60 }).notNull(),
  entityId: integer("entity_id"),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("activity_created_idx").on(t.createdAt)]);

export type CatalogItem = typeof catalogItems.$inferSelect;
export type HotelSettings = typeof siteSettings.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type ContentPage = typeof contentPages.$inferSelect;
