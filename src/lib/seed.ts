import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { catalogItems, contentPages, siteSettings, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";

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

async function seed() {
  try { await db.execute(sql.raw(REPAIR_SETTINGS_SQL)); } catch (error) { console.error("[Palacio] Settings schema repair failed:", error); }
  await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing();
  const existing = await db.select({ id: catalogItems.id }).from(catalogItems).limit(1);
  if (!existing.length) {
    await db.insert(catalogItems).values([
      { slug: "chambre-deluxe", category: "accommodation", nameFr: "Chambre Deluxe", nameEn: "Deluxe Room", descriptionFr: "Une parenthèse de douceur où matières naturelles et confort contemporain se rencontrent.", descriptionEn: "A haven of calm where natural textures meet contemporary comfort.", image: "/images/palacio-suite.jpg", price: 95000, pricingUnit: "night", capacity: 2, inventory: 8, amenitiesFr: ["Lit king size", "Petit-déjeuner", "Wi-Fi haut débit", "Vue jardin"], amenitiesEn: ["King bed", "Breakfast", "High-speed Wi-Fi", "Garden view"], featured: true },
      { slug: "suite-signature", category: "accommodation", nameFr: "Suite Signature", nameEn: "Signature Suite", descriptionFr: "Un espace généreux et raffiné, pensé pour les séjours qui méritent davantage.", descriptionEn: "A spacious, refined retreat for stays that deserve a little more.", image: "https://images.pexels.com/photos/6466236/pexels-photo-6466236.jpeg?auto=compress&cs=tinysrgb&w=1400", price: 165000, pricingUnit: "night", capacity: 3, inventory: 4, amenitiesFr: ["Suite spacieuse", "Salon privé", "Petit-déjeuner", "Service en chambre"], amenitiesEn: ["Spacious suite", "Private lounge", "Breakfast", "Room service"], featured: true },
      { slug: "suite-presidentielle", category: "accommodation", nameFr: "Suite Présidentielle", nameEn: "Presidential Suite", descriptionFr: "L’art de vivre Palacio dans sa plus belle expression : intimité, espace et attentions exclusives.", descriptionEn: "The Palacio lifestyle at its finest: privacy, space and exclusive touches.", image: "https://images.pexels.com/photos/8134775/pexels-photo-8134775.jpeg?auto=compress&cs=tinysrgb&w=1400", price: 275000, pricingUnit: "night", capacity: 4, inventory: 2, amenitiesFr: ["Terrasse privée", "Salon indépendant", "Conciergerie", "Transfert aéroport"], amenitiesEn: ["Private terrace", "Separate lounge", "Concierge", "Airport transfer"], featured: true },
      { slug: "chambre-jardin", category: "accommodation", nameFr: "Chambre Jardin", nameEn: "Garden Room", descriptionFr: "Un refuge lumineux ouvert sur la verdure, idéal pour ralentir le rythme.", descriptionEn: "A light-filled escape overlooking greenery, made for slowing down.", image: "https://images.pexels.com/photos/7031731/pexels-photo-7031731.jpeg?auto=compress&cs=tinysrgb&w=1400", price: 75000, pricingUnit: "night", capacity: 2, inventory: 6, amenitiesFr: ["Vue jardin", "Climatisation", "Wi-Fi", "Petit-déjeuner"], amenitiesEn: ["Garden view", "Air conditioning", "Wi-Fi", "Breakfast"] },
      { slug: "salon-acacia", category: "conference_room", nameFr: "Salon Acacia", nameEn: "Acacia Conference Room", descriptionFr: "Un cadre inspirant pour vos réunions, conférences et séminaires sur mesure.", descriptionEn: "An inspiring setting for meetings, conferences and tailored seminars.", image: "/images/palacio-conference.jpg", price: 350000, pricingUnit: "day", capacity: 60, inventory: 1, amenitiesFr: ["60 personnes", "Écran & projecteur", "Wi-Fi", "Pause-café"], amenitiesEn: ["60 guests", "Screen & projector", "Wi-Fi", "Coffee break"], featured: true },
      { slug: "salle-des-etoiles", category: "event_hall", nameFr: "Salle des Étoiles", nameEn: "Starlight Event Hall", descriptionFr: "Célébrez vos plus beaux moments dans un lieu aussi unique que votre histoire.", descriptionEn: "Celebrate your most memorable moments in a space as unique as your story.", image: "https://images.pexels.com/photos/16985201/pexels-photo-16985201.jpeg?auto=compress&cs=tinysrgb&w=1400", price: 650000, pricingUnit: "day", capacity: 180, inventory: 1, amenitiesFr: ["180 personnes", "Sonorisation", "Décoration modulable", "Traiteur"], amenitiesEn: ["180 guests", "Sound system", "Flexible décor", "Catering"], featured: true },
      { slug: "spa-bien-etre", category: "service", nameFr: "Spa & bien-être", nameEn: "Spa & Wellness", descriptionFr: "Offrez-vous un instant pour vous, entre sérénité et soins d’exception.", descriptionEn: "Take time for yourself with serene surroundings and exceptional treatments.", image: "https://images.pexels.com/photos/3757942/pexels-photo-3757942.jpeg?auto=compress&cs=tinysrgb&w=1400", price: 45000, pricingUnit: "person", capacity: 2, inventory: 10, amenitiesFr: ["Soins personnalisés", "Espace détente", "Sur réservation"], amenitiesEn: ["Personalized treatments", "Relaxation area", "By appointment"], featured: true },
      { slug: "table-palacio", category: "restaurant", nameFr: "La Table du Palacio", nameEn: "Palacio Dining", descriptionFr: "Une cuisine de saison qui met à l’honneur les saveurs du Cameroun et d’ailleurs.", descriptionEn: "Seasonal cuisine celebrating the flavours of Cameroon and beyond.", image: "/images/palacio-dining.jpg", price: 32000, pricingUnit: "person", capacity: 2, inventory: 40, amenitiesFr: ["Cuisine locale", "Terrasse", "Menu dégustation"], amenitiesEn: ["Local cuisine", "Terrace", "Tasting menu"], featured: true },
      { slug: "escapade-douala", category: "service", nameFr: "Escapade à Douala", nameEn: "Discover Douala", descriptionFr: "Laissez notre conciergerie vous dévoiler les plus belles adresses de la ville.", descriptionEn: "Let our concierge reveal the most beautiful corners of the city.", image: "https://images.pexels.com/photos/3011575/pexels-photo-3011575.jpeg?auto=compress&cs=tinysrgb&w=1400", price: 38000, pricingUnit: "person", capacity: 4, inventory: 8, amenitiesFr: ["Guide local", "Transport inclus", "Sur mesure"], amenitiesEn: ["Local guide", "Transport included", "Tailored experience"] },
    ]).onConflictDoNothing();
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
  const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!existingAdmin) {
    await db.insert(users).values({ fullName: "Administrateur Palacio", email: adminEmail, passwordHash: hashPassword(adminPassword), role: "admin" }).onConflictDoNothing();
    return;
  }
  if (!existingAdmin.active || existingAdmin.role === "guest" || !verifyPassword(adminPassword, existingAdmin.passwordHash)) {
    await db.update(users).set({ active: true, role: "admin", passwordHash: hashPassword(adminPassword) }).where(eq(users.id, existingAdmin.id));
  }
}

export async function ensureSeeded() {
  if (seeded) return;
  if (!pending) pending = seed();
  try { await pending; seeded = true; } finally { pending = null; }
}
