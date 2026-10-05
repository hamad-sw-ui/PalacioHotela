import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { catalogItems, contentPages, siteSettings, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { demoCatalogFeatures } from "@/lib/catalog-features";

let seeded = false;
let pending: Promise<void> | null = null;

/**
 * An early schema version named four `site_settings` columns after their default text and
 * left them nullable. This idempotent repair renames them, fills missing values and restores
 * the NOT NULL defaults. It is a no-op on healthy databases.
 */
export const REPAIR_SETTINGS_SQL = `
DO $$
DECLARE r record; legacy_name text;
BEGIN
  IF to_regclass('site_settings') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT * FROM (VALUES
    ('An exceptional stay%', 'hero_title_en', 'An exceptional stay, made for you.'),
    ('Au c%ur de Douala%', 'hero_subtitle_fr', 'Au cœur de Douala, découvrez une adresse où l’élégance rencontre la chaleur de l’hospitalité.'),
    ('In the heart of Douala%', 'hero_subtitle_en', 'In the heart of Douala, discover a place where elegance meets the warmth of hospitality.'),
    ('Bonanjo, Douala, Cameroon%', 'address_en', 'Bonanjo, Douala, Cameroon')
  ) AS v(legacy, target, fallback) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = r.target) THEN
      SELECT column_name INTO legacy_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name LIKE r.legacy LIMIT 1;
      IF legacy_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE site_settings RENAME COLUMN %I TO %I', legacy_name, r.target);
      ELSE
        EXECUTE format('ALTER TABLE site_settings ADD COLUMN %I text', r.target);
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = r.target AND is_nullable = 'YES') THEN
      EXECUTE format('UPDATE site_settings SET %I = %L WHERE %I IS NULL', r.target, r.fallback, r.target);
      EXECUTE format('ALTER TABLE site_settings ALTER COLUMN %I SET DEFAULT %L', r.target, r.fallback);
      EXECUTE format('ALTER TABLE site_settings ALTER COLUMN %I SET NOT NULL', r.target);
    END IF;
  END LOOP;
END $$;`;

const ADD_QUOTE_HEADER_SQL = `
DO $$
BEGIN
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'quote_header_image_url'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN quote_header_image_url text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('quote_requests') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'quote_requests' AND column_name = 'header_image_url'
  ) THEN
    ALTER TABLE quote_requests ADD COLUMN header_image_url text;
  END IF;
  IF to_regclass('contact_messages') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'contact_messages' AND column_name = 'reply'
  ) THEN
    ALTER TABLE contact_messages ADD COLUMN reply text;
  END IF;
  IF to_regclass('contact_messages') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'contact_messages' AND column_name = 'replied_at'
  ) THEN
    ALTER TABLE contact_messages ADD COLUMN replied_at timestamp with time zone;
  END IF;
  IF to_regclass('quote_requests') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'quote_requests' AND column_name = 'theme_snapshot'
  ) THEN
    ALTER TABLE quote_requests ADD COLUMN theme_snapshot varchar(24);
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'theme_colors'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN theme_colors jsonb;
  END IF;
  IF to_regclass('quote_requests') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'quote_requests' AND column_name = 'theme_palette_snapshot'
  ) THEN
    ALTER TABLE quote_requests ADD COLUMN theme_palette_snapshot jsonb;
  END IF;
  IF to_regclass('quote_requests') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'quote_requests' AND column_name = 'logo_snapshot'
  ) THEN
    ALTER TABLE quote_requests ADD COLUMN logo_snapshot text;
  END IF;
  IF to_regclass('quote_requests') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'quote_requests' AND column_name = 'tertiary_logo_snapshot'
  ) THEN
    ALTER TABLE quote_requests ADD COLUMN tertiary_logo_snapshot text;
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'secondary_logo_url'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN secondary_logo_url text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'tertiary_logo_url'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN tertiary_logo_url text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'quote_logo_variant'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN quote_logo_variant varchar(16) NOT NULL DEFAULT 'primary';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'instagram_url'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN instagram_url text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'smtp_host'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN smtp_host text NOT NULL DEFAULT '';
    ALTER TABLE site_settings ADD COLUMN smtp_port integer NOT NULL DEFAULT 587;
    ALTER TABLE site_settings ADD COLUMN smtp_secure boolean NOT NULL DEFAULT false;
    ALTER TABLE site_settings ADD COLUMN smtp_require_tls boolean NOT NULL DEFAULT true;
    ALTER TABLE site_settings ADD COLUMN smtp_user text NOT NULL DEFAULT '';
    ALTER TABLE site_settings ADD COLUMN smtp_password text NOT NULL DEFAULT '';
    ALTER TABLE site_settings ADD COLUMN smtp_from text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'ai_api_key'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN ai_api_key text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'stripe_secret_key'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN stripe_secret_key text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'stripe_webhook_secret'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN stripe_webhook_secret text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'paypal_client_id'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN paypal_client_id text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'paypal_client_secret'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN paypal_client_secret text NOT NULL DEFAULT '';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'paypal_env'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN paypal_env varchar(16) NOT NULL DEFAULT 'sandbox';
  END IF;
  IF to_regclass('site_settings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'site_settings' AND column_name = 'paypal_xaf_per_eur'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN paypal_xaf_per_eur double precision NOT NULL DEFAULT 655.957;
  END IF;
  IF to_regclass('quote_requests') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'quote_requests' AND column_name = 'people' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE quote_requests ALTER COLUMN people DROP NOT NULL;
    ALTER TABLE quote_requests ALTER COLUMN people DROP DEFAULT;
  END IF;
  IF to_regclass('catalog_items') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'catalog_items' AND column_name = 'images'
  ) THEN
    ALTER TABLE catalog_items ADD COLUMN images jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF to_regclass('catalog_items') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'catalog_items' AND column_name = 'features'
  ) THEN
    ALTER TABLE catalog_items ADD COLUMN features jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF to_regclass('bookings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'bookings' AND column_name = 'refund_ref'
  ) THEN
    ALTER TABLE bookings ADD COLUMN refund_ref text;
  END IF;
  IF to_regclass('bookings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'bookings' AND column_name = 'refund_error'
  ) THEN
    ALTER TABLE bookings ADD COLUMN refund_error text;
  END IF;
  IF to_regclass('users') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'google_sub'
  ) THEN
    ALTER TABLE users ADD COLUMN google_sub varchar(255);
  END IF;
  IF to_regclass('users') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'users_google_sub_unique'
  ) THEN
    CREATE UNIQUE INDEX users_google_sub_unique ON users (google_sub);
  END IF;
END $$;
UPDATE quote_requests
SET theme_snapshot = COALESCE((SELECT theme FROM site_settings WHERE id = 1), 'forest')
WHERE theme_snapshot IS NULL
  AND status IN ('quote_sent', 'negotiating', 'accepted', 'rejected', 'expired');`;

async function seed() {
  try { await db.execute(sql.raw(ADD_QUOTE_HEADER_SQL)); } catch (error) {
    if (process.env.NODE_ENV !== "development") console.error("[Palacio] Quote header column migration failed:", error);
  }
  try { await db.execute(sql.raw(REPAIR_SETTINGS_SQL)); } catch (error) {
    if (process.env.NODE_ENV !== "development") console.error("[Palacio] Settings schema repair failed:", error);
  }
  await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing();
  const existing = await db.select({ id: catalogItems.id }).from(catalogItems).limit(1);
  if (!existing.length) {
    await db.insert(catalogItems).values([
      { slug: "chambre-deluxe", category: "accommodation", nameFr: "Chambre Deluxe", nameEn: "Deluxe Room", descriptionFr: "Une parenthèse de douceur où matières naturelles et confort contemporain se rencontrent.", descriptionEn: "A haven of calm where natural textures meet contemporary comfort.", image: "/images/palacio-suite.jpg", price: 95000, pricingUnit: "night", capacity: 2, inventory: 8, amenitiesFr: ["Lit king size", "Petit-déjeuner", "Wi-Fi haut débit", "Vue jardin"], amenitiesEn: ["King bed", "Breakfast", "High-speed Wi-Fi", "Garden view"], featured: true },
      { slug: "suite-signature", category: "accommodation", nameFr: "Suite Signature", nameEn: "Signature Suite", descriptionFr: "Un espace généreux et raffiné, pensé pour les séjours qui méritent davantage.", descriptionEn: "A spacious, refined retreat for stays that deserve a little more.", image: "/images/palacio-suite.jpg", price: 165000, pricingUnit: "night", capacity: 3, inventory: 4, amenitiesFr: ["Suite spacieuse", "Salon privé", "Petit-déjeuner", "Service en chambre"], amenitiesEn: ["Spacious suite", "Private lounge", "Breakfast", "Room service"], featured: true },
      { slug: "suite-presidentielle", category: "accommodation", nameFr: "Suite Présidentielle", nameEn: "Presidential Suite", descriptionFr: "L’art de vivre Palacio dans sa plus belle expression : intimité, espace et attentions exclusives.", descriptionEn: "The Palacio lifestyle at its finest: privacy, space and exclusive touches.", image: "/images/palacio-suite.jpg", price: 275000, pricingUnit: "night", capacity: 4, inventory: 2, amenitiesFr: ["Terrasse privée", "Salon indépendant", "Conciergerie", "Transfert aéroport"], amenitiesEn: ["Private terrace", "Separate lounge", "Concierge", "Airport transfer"], featured: true },
      { slug: "chambre-jardin", category: "accommodation", nameFr: "Chambre Jardin", nameEn: "Garden Room", descriptionFr: "Un refuge lumineux ouvert sur la verdure, idéal pour ralentir le rythme.", descriptionEn: "A light-filled escape overlooking greenery, made for slowing down.", image: "/images/palacio-suite.jpg", price: 75000, pricingUnit: "night", capacity: 2, inventory: 6, amenitiesFr: ["Vue jardin", "Climatisation", "Wi-Fi", "Petit-déjeuner"], amenitiesEn: ["Garden view", "Air conditioning", "Wi-Fi", "Breakfast"] },
      { slug: "salon-acacia", category: "conference_room", nameFr: "Salon Acacia", nameEn: "Acacia Conference Room", descriptionFr: "Un cadre inspirant pour vos réunions, conférences et séminaires sur mesure.", descriptionEn: "An inspiring setting for meetings, conferences and tailored seminars.", image: "/images/palacio-conference.jpg", price: 350000, pricingUnit: "day", capacity: 60, inventory: 1, amenitiesFr: ["60 personnes", "Écran & projecteur", "Wi-Fi", "Pause-café"], amenitiesEn: ["60 guests", "Screen & projector", "Wi-Fi", "Coffee break"], featured: true },
      { slug: "salle-des-etoiles", category: "event_hall", nameFr: "Salle des Étoiles", nameEn: "Starlight Event Hall", descriptionFr: "Célébrez vos plus beaux moments dans un lieu aussi unique que votre histoire.", descriptionEn: "Celebrate your most memorable moments in a space as unique as your story.", image: "/images/palacio-conference.jpg", price: 650000, pricingUnit: "day", capacity: 180, inventory: 1, amenitiesFr: ["180 personnes", "Sonorisation", "Décoration modulable", "Traiteur"], amenitiesEn: ["180 guests", "Sound system", "Flexible décor", "Catering"], featured: true },
      { slug: "spa-bien-etre", category: "service", nameFr: "Spa & bien-être", nameEn: "Spa & Wellness", descriptionFr: "Offrez-vous un instant pour vous, entre sérénité et soins d’exception.", descriptionEn: "Take time for yourself with serene surroundings and exceptional treatments.", image: "/images/palacio-wellness.jpg", price: 45000, pricingUnit: "person", capacity: 2, inventory: 10, amenitiesFr: ["Soins personnalisés", "Espace détente", "Sur réservation"], amenitiesEn: ["Personalized treatments", "Relaxation area", "By appointment"], featured: true },
      { slug: "table-palacio", category: "restaurant", nameFr: "La Table du Palacio", nameEn: "Palacio Dining", descriptionFr: "Une cuisine de saison qui met à l’honneur les saveurs du Cameroun et d’ailleurs.", descriptionEn: "Seasonal cuisine celebrating the flavours of Cameroon and beyond.", image: "/images/palacio-dining.jpg", price: 32000, pricingUnit: "person", capacity: 2, inventory: 40, amenitiesFr: ["Cuisine locale", "Terrasse", "Menu dégustation"], amenitiesEn: ["Local cuisine", "Terrace", "Tasting menu"], featured: true },
      { slug: "escapade-douala", category: "service", nameFr: "Escapade à Douala", nameEn: "Discover Douala", descriptionFr: "Laissez notre conciergerie vous dévoiler les plus belles adresses de la ville.", descriptionEn: "Let our concierge reveal the most beautiful corners of the city.", image: "/images/palacio-hero.jpg", price: 38000, pricingUnit: "person", capacity: 4, inventory: 8, amenitiesFr: ["Guide local", "Transport inclus", "Sur mesure"], amenitiesEn: ["Local guide", "Transport included", "Tailored experience"] },
    ]).onConflictDoNothing();
  }
  for (const [slug, features] of Object.entries(demoCatalogFeatures)) {
    await db.update(catalogItems).set({ features }).where(and(eq(catalogItems.slug, slug), sql`jsonb_array_length(${catalogItems.features}) = 0`));
  }
  const page = await db.select({ id: contentPages.id }).from(contentPages).limit(1);
  if (!page.length) {
    await db.insert(contentPages).values([
      { slug: "notre-histoire", titleFr: "L’esprit Palacio", titleEn: "The Palacio spirit", bodyFr: "Bienvenue dans un lieu où l’hospitalité a le sens du détail.\n\nAu cœur de Douala, le Palacio Hotel vous accueille dans un écrin de sérénité. Une architecture intemporelle, des espaces baignés de lumière et une équipe attentive donnent à chaque séjour sa propre histoire.\n\nQue vous veniez pour une escapade, un rendez-vous professionnel ou une célébration, nous imaginons avec vous une expérience qui vous ressemble.", bodyEn: "Welcome to a place where hospitality lives in the details.\n\nIn the heart of Douala, Palacio Hotel welcomes you into a haven of serenity. Timeless architecture, light-filled spaces and an attentive team give every stay its own story.\n\nWhether you're here for a getaway, a business meeting or a celebration, we create an experience that feels like yours.", image: "/images/palacio-hero.jpg" },
      { slug: "confidentialite", titleFr: "Politique de confidentialité", titleEn: "Privacy policy", bodyFr: "Vos données personnelles sont utilisées uniquement pour traiter vos demandes de réservation, de devis et vos messages. Elles sont accessibles à l’équipe Palacio Hotel et ne sont jamais revendues. Contactez-nous pour toute demande d’accès, de rectification ou de suppression.", bodyEn: "Your personal data is used only to process your booking requests, quote requests and messages. It is accessible to the Palacio Hotel team and is never sold. Contact us to request access, correction or deletion." },
    ]).onConflictDoNothing();
  }
  await ensureAdminAccount();
}

/**
 * Keeps the backoffice reachable: guarantees the administrator account exists,
 * is active, and still matches the configured (or demo) credentials.
 * Deliberately NOT cached, so a deleted, deactivated or degraded account is
 * repaired on the next sign-in attempt or backoffice visit.
 */
export async function ensureAdminAccount() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@palaciohotel.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Palacio2026!";
  try {
    const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
    if (!existingAdmin) {
      await db.insert(users).values({ fullName: "Administrateur Palacio", email: adminEmail, passwordHash: hashPassword(adminPassword), role: "admin" }).onConflictDoNothing();
      return;
    }
    if (!existingAdmin.active || existingAdmin.role === "guest" || !verifyPassword(adminPassword, existingAdmin.passwordHash)) {
      await db.update(users).set({ active: true, role: "admin", passwordHash: hashPassword(adminPassword) }).where(eq(users.id, existingAdmin.id));
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    console.warn("[Palacio] Database unavailable in development; skipping admin account repair.");
  }
}

export async function ensureSeeded() {
  if (seeded) return;
  if (!pending) pending = seed();
  try {
    await pending;
    seeded = true;
  } catch (error) {
    if (process.env.NODE_ENV !== "development") throw error;
    // A local preview can render with the safe settings/catalog fallbacks when PostgreSQL
    // is not running. Production still fails loudly instead of hiding a database outage.
    seeded = true;
  } finally { pending = null; }
}
