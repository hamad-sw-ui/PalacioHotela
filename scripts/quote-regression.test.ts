import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { quoteLineTotal, quoteTotal, restaurantLineIdentity } from "@/lib/quote-pricing";
import { buildQuotePdfV2 } from "@/lib/pdf-quote-v2";
import { buildQuotePdfV3 } from "@/lib/pdf-quote-v3";
import { analyzeQuoteMessage } from "@/lib/ai-provider";
import { enrichQuoteItems } from "@/lib/quote-items";
import { buildQuoteDocumentModel } from "@/lib/quote-document-model";
import { quoteInput } from "@/lib/validation";
import { quoteVisibleToAccount } from "@/lib/quote-account";
import { containInBox } from "@/lib/pdf-image-fit";
import { decodeSignature } from "@/lib/signature-file";
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

test("quote validation accepts a HH:MM time and all five meal types", () => {
  const parsed = quoteInput.parse({
    guestName: "Client Test",
    guestEmail: "client@example.com",
    guestPhone: "+237600000000",
    requestKind: "restaurant",
    selectedItems: [{
      property_id: 3,
      quantity: 1,
      order_time: "13:00",
      order_dates: ["2027-01-10"],
      meal_types: ["breakfast", "lunch", "dinner", "snacks", "other"],
    }],
    checkIn: "2027-01-10",
    checkOut: "2027-01-12",
    people: 2,
    message: "Demande de restauration complète.",
  });
  assert.equal(parsed.selectedItems[0].order_time, "13:00");
  assert.equal(parsed.selectedItems[0].meal_types?.length, 5);
});

test("quote validation keeps the project description optional", () => {
  const parsed = quoteInput.parse({
    guestName: "Client Test",
    guestEmail: "client@example.com",
    guestPhone: "+237600000000",
    requestKind: "accommodation",
    selectedItems: [{ property_id: 1, quantity: 1 }],
    checkIn: "2027-01-10",
    checkOut: "2027-01-12",
    people: 2,
  });
  assert.equal(parsed.message, "");
});

test("a quote reaches the matching client account and stays private otherwise", () => {
  const user = { id: 4, email: "Client@Example.com" };
  assert.equal(quoteVisibleToAccount({ userId: 4, guestEmail: "other@example.com" }, user), true);
  assert.equal(quoteVisibleToAccount({ userId: null, guestEmail: "client@example.com" }, user), true);
  assert.equal(quoteVisibleToAccount({ userId: 9, guestEmail: "client@example.com" }, user), false);
  assert.equal(quoteVisibleToAccount({ userId: null, guestEmail: "guest@example.com" }, user), false);
});

test("a digital signature is accepted only as a real PNG or JPEG", () => {
  const png = Buffer.concat([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"), Buffer.alloc(80)]);
  assert.equal(decodeSignature(`data:image/png;base64,${png.toString("base64")}`).extension, "png");
  assert.throws(() => decodeSignature("data:image/webp;base64,AAAA"), /PNG ou JPEG/);
});

test("a stamp keeps the same place and stays fully visible at any resolution", () => {
  const box = { x: 475, y: 80, width: 72, height: 72 };
  const large = containInBox({ width: 1024, height: 1024 }, box);
  const small = containInBox({ width: 64, height: 64 }, box);
  const wide = containInBox({ width: 2000, height: 400 }, box);
  assert.deepEqual(large, small);
  assert.equal(large.x, box.x);
  assert.equal(large.y, box.y);
  assert.equal(large.width, box.width);
  assert.ok(wide.width <= box.width && wide.height <= box.height);
  assert.ok(wide.x >= box.x && wide.y >= box.y);
  assert.ok(wide.x + wide.width <= box.x + box.width + 0.01);
  assert.ok(wide.y + wide.height <= box.y + box.height + 0.01);
  assert.equal(wide.width, box.width);
});

test("catalog enrichment normalizes and merges identical restaurant configurations", () => {
  const dining = catalog({ id: 3, category: "restaurant", nameFr: "La Table", nameEn: "Dining", slug: "table", pricingUnit: "person", price: 5000 });
  const lines = enrichQuoteItems([
    { property_id: 3, quantity: 1, order_dates: ["2027-01-11", "2027-01-10"], meal_types: ["Dinner", "lunch"], order_time: "13:00" },
    { property_id: 3, quantity: 2, order_dates: ["2027-01-10", "2027-01-11"], meal_types: ["lunch", "dinner"], order_time: "13:00" },
  ], [dining], { source: "web" });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 3);
  assert.deepEqual(lines[0].meal_types, ["dinner", "lunch"]);
  assert.equal(quoteTotal(lines), 60000);
});

test("PDF v3 uses the normalized document model in every platform theme", async () => {
  const request = { ...quote([restaurant()]), pdfTemplateVersion: 3, amountTtc: 42000, validUntil: "2027-02-01", adminSignerRole: "Direction" };
  for (const theme of ["forest", "midnight", "terracotta"] as const) {
    const themedSettings = { ...settings, theme };
    const model = buildQuoteDocumentModel(request, themedSettings, "quote");
    assert.equal(model.total, 42000);
    assert.equal(model.lines[0].total, 40000);
    assert.equal(model.signatures.adminRole, "Direction");
    const bytes = await buildQuotePdfV3(request, themedSettings, "quote");
    const document = await PDFDocument.load(bytes);
    assert.ok(bytes.byteLength > 1000);
    assert.equal(document.getPages()[0].getSize().width, 595);
    assert.equal(document.getPages()[0].getSize().height, 842);
  }
});

test("PDF v3 receipt and long quote remain valid paginated A4 documents", async () => {
  const items = Array.from({ length: 24 }, (_, index) => restaurant({ property_id: index + 1, name_fr: `Prestation ${index + 1}`, name_en: `Item ${index + 1}` }));
  const request = { ...quote(items), pdfTemplateVersion: 3 };
  const receipt = await PDFDocument.load(await buildQuotePdfV3(request, settings, "receipt"));
  const commercial = await PDFDocument.load(await buildQuotePdfV3(request, settings, "quote"));
  assert.ok(receipt.getPages().length > 1);
  assert.ok(commercial.getPages().length > 1);
  assert.ok(commercial.getPages().every((page) => page.getSize().width === 595 && page.getSize().height === 842));
});
