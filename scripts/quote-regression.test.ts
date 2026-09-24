import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { quoteLineTotal, quoteTotal, restaurantLineIdentity } from "@/lib/quote-pricing";
import { buildQuotePdfV2 } from "@/lib/pdf-quote-v2";
import { analyzeQuoteMessage } from "@/lib/ai-provider";
import type { CatalogItem, HotelSettings, QuoteRequest, SelectedItem } from "@/db/schema";

const restaurant = (overrides: Partial<SelectedItem> = {}): SelectedItem => ({
  property_id: 7,
  type: "restaurant",
  name_fr: "Poulet braisé",
  name_en: "Grilled chicken",
  price: 5000,
  quantity: 2,
  order_dates: ["2027-01-10", "2027-01-11"],
  meal_types: ["dinner", "lunch"],
  order_time: "13:00",
  ...overrides,
});

const settings = {
  id: 1, hotelName: "Palacio Hotel", logoUrl: "", heroImage: "", heroTitleFr: "", heroTitleEn: "", heroSubtitleFr: "", heroSubtitleEn: "", aboutFr: "", aboutEn: "", aboutImage: "", theme: "forest", email: "bonjour@palaciohotel.com", phone: "+237 699 00 00 00", whatsapp: "237699000000", addressFr: "Bonanjo, Douala, Cameroun", addressEn: "Bonanjo, Douala, Cameroon", latitude: 4, longitude: 9, acceptingQuotes: true, aiProvider: "auto", aiBaseUrl: "", aiModel: "", quoteSignatureUrl: "", quoteStampUrl: "", quoteSignerName: "Amin Palacio", quoteSignerRole: "Direction", quoteTermsFr: "Aucun paiement n'est dû avant confirmation.", quoteTermsEn: "No payment is due before confirmation.", updatedAt: new Date(),
} as HotelSettings;

function quote(items: SelectedItem[]): QuoteRequest {
  return { id: 1, reference: "DEV-2027-00001", publicToken: "token", userId: null, guestName: "Client Test", guestEmail: "client@example.com", guestPhone: "+237600000000", company: "", locale: "fr", requestKind: "mixed", selectedItems: items, checkIn: "2027-01-10", checkOut: "2027-01-12", people: 2, message: "Demande de test de non régression.", budget: null, estimatedTotal: quoteTotal(items), amountTtc: null, validUntil: null, status: "new", adminNotes: "", pdfTemplateVersion: 2, adminSignatureUrl: null, adminSignerName: null, adminSignerRole: null, adminSignedAt: null, adminStampUrl: null, clientSignatureUrl: null, clientSignerName: null, clientSignedAt: null, clientAcceptanceIp: null, clientAcceptanceUserAgent: null, termsSnapshotFr: "", termsSnapshotEn: "", createdAt: new Date("2026-09-24T10:00:00Z"), updatedAt: new Date("2026-09-24T10:00:00Z") };
}

test("restaurant pricing follows quantity × days × meals", () => {
  assert.equal(quoteLineTotal(restaurant()), 40000);
  assert.equal(quoteLineTotal(restaurant({ meal_types: [] })), 20000);
  assert.equal(quoteLineTotal(restaurant({ order_dates: [] })), 20000);
});

test("restaurant identity keeps variants separate and normalizes order", () => {
  const first = restaurant({ meal_types: ["Dinner", "lunch"], order_dates: ["2027-01-11", "2027-01-10"] });
  const same = restaurant({ meal_types: ["lunch", "dinner"], order_dates: ["2027-01-10", "2027-01-11"] });
  const otherTime = restaurant({ order_time: "20:00" });
  assert.equal(restaurantLineIdentity(first), restaurantLineIdentity(same));
  assert.notEqual(restaurantLineIdentity(first), restaurantLineIdentity(otherTime));
});

test("PDF v2 is generated with all lines and a stable A4 document", async () => {
  const items = [restaurant(), { ...restaurant({ property_id: 8, name_fr: "Spa", name_en: "Spa", type: "service", price: 45000, meal_types: undefined, order_dates: undefined }), quantity: 1 }];
  const bytes = await buildQuotePdfV2(quote(items), settings, "quote");
  assert.ok(bytes.byteLength > 1000);
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPages().length, 1);
  assert.equal(quoteTotal(items), 85000);
});

const catalog = (overrides: Partial<CatalogItem>): CatalogItem => ({ id: 1, slug: "item", category: "accommodation", nameFr: "Chambre Deluxe", nameEn: "Deluxe Room", descriptionFr: "", descriptionEn: "", image: "", price: 95000, pricingUnit: "night", capacity: 2, inventory: 8, amenitiesFr: [], amenitiesEn: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date(), ...overrides });

test("local quote assistant turns natural language into catalog-backed lines", async () => {
  const result = await analyzeQuoteMessage({
    provider: "local",
    locale: "fr",
    message: "Nous sommes 18 personnes du 10 novembre au 12 novembre. Il nous faut 6 chambres, une salle de réunion, le déjeuner et le dîner.",
    catalog: [catalog({ id: 1, category: "accommodation" }), catalog({ id: 2, category: "conference_room", nameFr: "Salon Acacia", nameEn: "Acacia Conference Room", slug: "salon-acacia", pricingUnit: "day", capacity: 60, price: 350000 }), catalog({ id: 3, category: "restaurant", nameFr: "La Table du Palacio", nameEn: "Palacio Dining", slug: "table-palacio", pricingUnit: "person", price: 32000 })],
  people: 18,
  checkIn: null,
  checkOut: null,
});
  assert.equal(result.source, "local");
  assert.ok(result.lines.some((line) => line.category === "accommodation" && line.quantity === 6));
  assert.ok(result.lines.some((line) => line.category === "conference_room"));
  assert.ok(result.lines.some((line) => line.category === "restaurant" && line.mealTypes?.includes("lunch") && line.mealTypes.includes("dinner")));
  assert.ok(result.lines.every((line) => line.catalogItemId));
});
