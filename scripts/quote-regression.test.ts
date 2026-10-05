import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { quoteLineTotal, quoteTotal, restaurantLineIdentity } from "@/lib/quote-pricing";
import { buildQuotePdfV2 } from "@/lib/pdf-quote-v2";
import { buildQuotePdfV3 } from "@/lib/pdf-quote-v3";
import { analyzeQuoteMessage, chatCompletionsUrl, probeAi, redactAiError, resolveAiConfig } from "@/lib/ai-provider";
import { assembleQuoteAssistantTable, coerceAssistantModel } from "@/lib/quote-assistant-assemble";
import { enrichQuoteItems } from "@/lib/quote-items";
import { buildQuoteDocumentModel } from "@/lib/quote-document-model";
import { quoteInput } from "@/lib/validation";
import { quoteVisibleToAccount } from "@/lib/quote-account";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { demandFits, occupiedPeak, quoteOccupiesStock, remainingFromStays } from "@/lib/availability";
import { countryAccepted } from "@/lib/account-rules";
import { replyAccepted, statusAfterOpen } from "@/lib/message-rules";
import { bookingAdminHref, notificationMatchesRead } from "@/lib/notification-links";
import { activityDetail, activityShouldBeWritten, activityTarget } from "@/lib/activity-links";
import { emailLogoAddress, emailLogoDelivery, emailPalette, themedEmailHtml } from "@/lib/email-theme";
import { bookingMailDetail, cancellationNotice, guestCancellationCopy, mailDate, quoteMailDetail, requestKindLabel } from "@/lib/mail";
import { formatCoordinate, formatHotelPosition, coordinateValue, geocodeAddress, nominatimPoint } from "@/lib/geo";
import { hexColor, mergePalette, paletteIsCustom, resolveQuotePalette, resolveQuoteTheme } from "@/lib/quote-pdf-theme";
import { readFileSync } from "node:fs";
import { themeColor } from "@/lib/platform-colors";
import { reservedPageChangeBlocked } from "@/lib/content-pages";
import { resolveQuoteHeaderImage, resolveQuoteLogo, resolveQuoteMonogram } from "@/lib/quote-header";
import { logoForVariant, quoteLogoUrl, quoteTabIconUrl } from "@/lib/brand-logos";
import { brandImagePath } from "@/lib/brand-image";
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
  id: 1, hotelName: "Palacio Hotel", logoUrl: "", secondaryLogoUrl: "", tertiaryLogoUrl: "", quoteLogoVariant: "primary", heroImage: "", heroTitleFr: "", heroTitleEn: "", heroSubtitleFr: "", heroSubtitleEn: "", aboutFr: "", aboutEn: "", aboutImage: "", theme: "forest", email: "bonjour@palaciohotel.com", phone: "+237 699 00 00 00", whatsapp: "237699000000", addressFr: "Bonanjo, Douala, Cameroun", addressEn: "Bonanjo, Douala, Cameroon", latitude: 4, longitude: 9, acceptingQuotes: true, aiProvider: "auto", aiBaseUrl: "", aiModel: "", aiApiKey: "", quoteSignatureUrl: "", quoteStampUrl: "", quoteHeaderImageUrl: "", quoteSignerName: "Amin Palacio", quoteSignerRole: "Direction", quoteTermsFr: "Aucun paiement n'est dû avant confirmation.", quoteTermsEn: "No payment is due before confirmation.", updatedAt: new Date(),
} as HotelSettings;

function quote(items: SelectedItem[]): QuoteRequest {
  return { id: 1, reference: "DEV-2027-00001", publicToken: "token", userId: null, guestName: "Client Test", guestEmail: "client@example.com", guestPhone: "+237600000000", company: "", locale: "fr", requestKind: "mixed", selectedItems: items, checkIn: "2027-01-10", checkOut: "2027-01-12", people: 2, message: "Demande de test de non régression.", budget: null, estimatedTotal: quoteTotal(items), amountTtc: null, validUntil: null, status: "new", adminNotes: "", pdfTemplateVersion: 2, adminSignatureUrl: null, adminSignerName: null, adminSignerRole: null, adminSignedAt: null, adminStampUrl: null, headerImageUrl: null, logoSnapshot: null, tertiaryLogoSnapshot: null, themeSnapshot: null, themePaletteSnapshot: null, clientSignatureUrl: null, clientSignerName: null, clientSignedAt: null, clientAcceptanceIp: null, clientAcceptanceUserAgent: null, termsSnapshotFr: "", termsSnapshotEn: "", createdAt: new Date("2026-09-24T10:00:00Z"), updatedAt: new Date("2026-09-24T10:00:00Z") };
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

const catalog = (overrides: Partial<CatalogItem>): CatalogItem => ({ id: 1, slug: "item", category: "accommodation", nameFr: "Chambre Deluxe", nameEn: "Deluxe Room", descriptionFr: "", descriptionEn: "", image: "", price: 95000, pricingUnit: "night", capacity: 2, inventory: 8, amenitiesFr: [], amenitiesEn: [], featured: true, active: true, createdAt: new Date(), updatedAt: new Date(), ...overrides, images: overrides.images ?? [], features: overrides.features ?? [] });

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

test("assistant table assembly maps a messy Gemini payload onto priced catalog lines", () => {
  const items = [catalog({ id: 1, category: "accommodation" }), catalog({ id: 2, category: "conference_room", nameFr: "Salon Acacia", nameEn: "Acacia Conference Room", slug: "salon-acacia", pricingUnit: "day", capacity: 60, price: 350000 }), catalog({ id: 3, category: "restaurant", nameFr: "La Table du Palacio", nameEn: "Palacio Dining", slug: "table-palacio", pricingUnit: "person", price: 32000 })];
  const model = coerceAssistantModel({
    extra: "ignored",
    lines: [
      { requestedLabel: "6 chambres Deluxe", category: "accommodation", catalogItemId: "1", quantity: 18, checkIn: "10 novembre 2026", checkOut: "12 novembre 2026", nights: 3 },
      { requestedLabel: "Salon Acacia", category: "conference_room", catalogItemId: 2, quantity: 1, dates: ["11 novembre 2026"] },
      { requestedLabel: "La Table du Palacio", category: "restaurant", catalogItemId: 3, quantity: 1, mealTypes: ["déjeuner", "dîner"], meal_types: ["ignored"] },
      { category: "spaceship", requestedLabel: "invalid" },
    ],
    questions: [],
    warnings: [],
    confidence: 0.9,
  });
  const table = assembleQuoteAssistantTable({
    message: "Bonjour, nous serons 18 personnes du 10 au 12 novembre 2026. Il nous faut 6 chambres Deluxe, le Salon Acacia pour une réunion le 11 novembre, le déjeuner et le dîner à La Table du Palacio.",
    locale: "fr",
    catalog: items,
    model,
    source: "ai",
  });
  assert.equal(table.source, "ai");
  assert.equal(table.canApply, true);
  assert.equal(table.checkIn, "2026-11-10");
  assert.equal(table.checkOut, "2026-11-12");
  assert.equal(table.people, 18);
  const fromText = assembleQuoteAssistantTable({
    message: "Nous serons 18 personnes du 10 au 12 novembre 2026 pour 6 chambres Deluxe.",
    locale: "fr",
    catalog: items,
    model: { lines: [{ requestedLabel: "hébergement", category: "accommodation", quantity: 6, confidence: 0.8 }], questions: [], warnings: [], confidence: 0.8 },
    checkIn: "2026-09-25",
    checkOut: "2026-09-28",
    people: 2,
    source: "local",
  });
  assert.equal(fromText.checkIn, "2026-11-10");
  assert.equal(fromText.checkOut, "2026-11-12");
  assert.equal(fromText.people, 18);
  const meeting = assembleQuoteAssistantTable({
    message: "Réunion le 11 novembre 2026 dans le Salon Acacia, séjour du 10 au 12 novembre 2026.",
    locale: "fr",
    catalog: items,
    model: { lines: [{ requestedLabel: "Salon Acacia", category: "conference_room", catalogItemId: 2, quantity: 1, dates: ["2026-11-10", "2026-11-11"], confidence: 0.8 }], questions: [], warnings: [], confidence: 0.8 },
    source: "local",
  });
  assert.deepEqual(meeting.lines[0]?.dates, ["2026-11-11"]);
  assert.equal(table.lines.length, 3);
  const rooms = table.lines.find((line) => line.category === "accommodation");
  const hall = table.lines.find((line) => line.category === "conference_room");
  const dining = table.lines.find((line) => line.category === "restaurant");
  assert.equal(rooms?.quantity, 6);
  assert.deepEqual(hall?.dates, ["2026-11-11"]);
  assert.deepEqual(dining?.mealTypes, ["dinner", "lunch"]);
  assert.deepEqual(dining?.dates, ["2026-11-10", "2026-11-11"]);
  assert.equal(dining?.quantity, 18);
  const priced = table.lines.map((line) => {
    const item = items.find((entry) => entry.id === line.catalogItemId)!;
    return { type: item.category as "accommodation" | "conference_room" | "restaurant", price: item.price, quantity: line.quantity, check_in: table.checkIn || undefined, check_out: table.checkOut || undefined, dates: line.dates, order_dates: line.dates, meal_types: line.mealTypes };
  });
  assert.equal(quoteTotal(priced), quoteTotal([
    { type: "accommodation", price: 95000, quantity: 6, check_in: "2026-11-10", check_out: "2026-11-12" },
    { type: "conference_room", price: 350000, quantity: 1, dates: ["2026-11-11"] },
    { type: "restaurant", price: 32000, quantity: 18, order_dates: ["2026-11-10", "2026-11-11"], meal_types: ["lunch", "dinner"] },
  ]));
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
  const open = quoteInput.parse({
    guestName: "Client Test",
    guestEmail: "client@example.com",
    guestPhone: "+237600000000",
    requestKind: "service",
    selectedItems: [{ property_id: 1, quantity: 1 }],
    checkIn: "",
    checkOut: null,
    people: "",
  });
  assert.equal(open.checkIn, null);
  assert.equal(open.checkOut, null);
  assert.equal(open.people, null);
  const oneDate = quoteInput.parse({
    guestName: "Client Test",
    guestEmail: "client@example.com",
    guestPhone: "+237600000000",
    requestKind: "event_hall",
    selectedItems: [{ property_id: 1, quantity: 1 }],
    checkIn: "2027-01-10",
    people: "",
  });
  assert.equal(oneDate.checkIn, "2027-01-10");
  assert.equal(oneDate.checkOut, null);
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

test("availability follows the busiest day and frees the checkout day", () => {
  const separateNights = Array.from({ length: 8 }, (_, index) => ({ start: `2027-06-${String(index * 2 + 1).padStart(2, "0")}`, end: `2027-06-${String(index * 2 + 2).padStart(2, "0")}`, quantity: 1 }));
  assert.equal(remainingFromStays(8, "2027-06-01", "2027-06-20", separateNights), 7);
  assert.equal(remainingFromStays(1, "2027-06-03", "2027-06-05", [{ start: "2027-06-01", end: "2027-06-03", quantity: 1 }]), 1);
  assert.equal(remainingFromStays(1, "2027-06-01", "2027-06-06", [{ start: "2027-06-01", end: "2027-06-03", quantity: 1 }, { start: "2027-06-03", end: "2027-06-05", quantity: 1 }]), 0);
});

test("hotel coordinates stay exact while typing and appear on the homepage", () => {
  assert.equal(coordinateValue("4.0511", -90, 90), 4.0511);
  assert.equal(coordinateValue("4.", -90, 90), null);
  assert.equal(coordinateValue("", -90, 90), null);
  assert.equal(coordinateValue("91", -90, 90), null);
  assert.equal(coordinateValue("-4,05", -90, 90), -4.05);
  assert.equal(formatHotelPosition(4.0511, 9.7679), "04°03′ N\u00a0\u00a009°46′ E");
  assert.equal(geocodeAddress("  Bonanjo, Douala  ", "Douala"), "Bonanjo, Douala");
  assert.equal(geocodeAddress("   ", " Douala, Cameroon "), "Douala, Cameroon");
  assert.equal(geocodeAddress("", "  "), null);
  assert.deepEqual(nominatimPoint([{ lat: "4.0511", lon: "9.7679" }]), { latitude: 4.0511, longitude: 9.7679 });
  assert.equal(nominatimPoint([]), null);
  assert.equal(nominatimPoint([{ lat: "91", lon: "9.7" }]), null);
  assert.equal(formatCoordinate(4.0511), "4.051100");
  assert.equal(resolveQuoteTheme({ themeSnapshot: "midnight" }, { theme: "forest" }), "midnight");
  assert.equal(resolveQuoteTheme({ themeSnapshot: null }, { theme: "terracotta" }), "terracotta");
  assert.equal(resolveQuoteTheme({}, { theme: "unknown" }), "forest");
  assert.equal(emailPalette("forest").deep, "#18382e");
  assert.equal(emailPalette("forest").footer, "#f0eee8");
  assert.equal(emailPalette("midnight").deep, "#1b303c");
  assert.match(themedEmailHtml("terracotta", { eyebrow: "MESSAGE", title: "Merci", greeting: "Bonjour,", body: "Reçu.", detail: "<strong>Sujet</strong>", footer: "À bientôt.", hotelName: "Palacio", address: "Douala", phone: "+237", email: "bonjour@palaciohotel.com" }), /#6d3f31/);
  assert.equal(mergePalette("forest", null).primary, "#18382e");
  assert.equal(mergePalette("midnight", null).primary, "#1b303c");
  assert.equal(mergePalette("forest", { primary: "#112233" }).primary, "#112233");
  assert.equal(mergePalette("forest", { primary: "#112233" }).dark, "#102d26");
  assert.equal(hexColor("#abc"), "#aabbcc");
  assert.equal(hexColor("red"), null);
  assert.equal(hexColor(""), null);
  assert.equal(paletteIsCustom("forest", { primary: "#18382e" }), false);
  assert.equal(paletteIsCustom("forest", { primary: "#112233" }), true);
  assert.equal(resolveQuotePalette({ themeSnapshot: "forest", themePaletteSnapshot: { primary: "#112233" } }, { theme: "forest", themeColors: { primary: "#abcdef" } }).primary, "#112233");
  assert.equal(resolveQuotePalette({ themeSnapshot: "midnight", themePaletteSnapshot: null }, { theme: "forest", themeColors: { primary: "#112233" } }).primary, "#1b303c");
  assert.equal(resolveQuotePalette({ themeSnapshot: null, themePaletteSnapshot: null }, { theme: "forest", themeColors: { primary: "#112233" } }).primary, "#112233");
  assert.equal(themeColor("#f4f3ee", "forest"), "#f4f3ee");
  assert.equal(themeColor("#18382e", "midnight"), "#1b303c");
  assert.notEqual(themeColor("#f4f3ee", "midnight"), "#f4f3ee");
  for (const file of ["src/app/globals.css", "src/app/extra.css", "src/app/quote-enhancements.css"]) {
    assert.equal(/#(?:[0-9a-fA-F]{3,8})\b/.test(readFileSync(file, "utf8")), false, file);
  }
});

test("activity rows open a live record, and an automatic read is not written", () => {
  assert.equal(activityTarget("messages"), "messages");
  assert.equal(activityTarget("booking"), "bookings");
  assert.equal(activityTarget("settings"), null);
  assert.equal(activityTarget("media"), null);
  assert.equal(activityShouldBeWritten("messages", "read"), false);
  assert.equal(activityShouldBeWritten("notifications", "read", true), false);
  assert.equal(activityShouldBeWritten("notifications", "read", false), true);
  assert.equal(activityDetail("messages", "reply", { subject: "Réservation", emailSent: false }), "Réservation · E-mail non envoyé");
  assert.equal(activityDetail("users", "update", { fullName: "Administrateur Palacio" }), "Administrateur Palacio");
  assert.equal(activityDetail("bookings", "bulk", { count: 2 }), "Traitement groupé : 2 élément(s).");
});

test("a booking alert opens its stay, and the unread filter keeps read alerts out", () => {
  assert.equal(bookingAdminHref(12), "/admin?section=reservations&booking=12");
  assert.equal(notificationMatchesRead(false, "unread"), true);
  assert.equal(notificationMatchesRead(true, "unread"), false);
  assert.equal(notificationMatchesRead(true, "read"), true);
  assert.equal(notificationMatchesRead(false, "all"), true);
});

test("opening a new message marks it read, and a reply needs real text", () => {
  assert.equal(statusAfterOpen("new"), "read");
  assert.equal(statusAfterOpen("read"), "read");
  assert.equal(statusAfterOpen("answered"), "answered");
  assert.equal(replyAccepted("  "), false);
  assert.equal(replyAccepted("A"), false);
  assert.equal(replyAccepted("Nous vous rappelons demain."), true);
});

test("an account can be saved without a country, and a one-letter country is refused", () => {
  assert.equal(countryAccepted(""), true);
  assert.equal(countryAccepted("  "), true);
  assert.equal(countryAccepted("A"), false);
  assert.equal(countryAccepted("Cameroun"), true);
});

test("linked content pages keep their address and publication", () => {
  assert.equal(reservedPageChangeBlocked("confidentialite", { remove: true }), true);
  assert.equal(reservedPageChangeBlocked("notre-histoire", { slug: "histoire" }), true);
  assert.equal(reservedPageChangeBlocked("confidentialite", { published: false }), true);
  assert.equal(reservedPageChangeBlocked("confidentialite", { slug: "confidentialite", published: true }), false);
  assert.equal(reservedPageChangeBlocked("services", { remove: true }), false);
});

test("catalog stock cannot drop under the occupied peak", () => {
  assert.equal(occupiedPeak([]), 0);
  assert.equal(occupiedPeak([{ start: "2027-07-01", end: "2027-07-03", quantity: 5 }, { start: "2027-07-01", end: "2027-07-03", quantity: 4 }]), 9);
  assert.equal(occupiedPeak([{ start: "2027-07-01", end: "2027-07-02", quantity: 5 }, { start: "2027-07-02", end: "2027-07-03", quantity: 5 }]), 5);
});

test("several lines of the same item share one stock ceiling", () => {
  const sameNights = [
    { start: "2027-07-01", end: "2027-07-03", quantity: 5 },
    { start: "2027-07-01", end: "2027-07-03", quantity: 5 },
  ];
  assert.equal(demandFits(8, sameNights), false);
  assert.equal(demandFits(8, [
    { start: "2027-07-01", end: "2027-07-02", quantity: 5 },
    { start: "2027-07-02", end: "2027-07-03", quantity: 5 },
  ]), true);
  assert.equal(demandFits(8, [{ start: "2027-07-01", end: "2027-07-03", quantity: 5 }], [{ start: "2027-07-01", end: "2027-07-03", quantity: 4 }]), false);
  assert.equal(quoteOccupiesStock("new") && quoteOccupiesStock("in_review") && quoteOccupiesStock("quote_sent"), true);
  assert.equal(quoteOccupiesStock("cancelled") || quoteOccupiesStock("rejected") || quoteOccupiesStock("expired"), false);
  const lastUnit = [{ start: "2027-08-01", end: "2027-08-03", quantity: 1 }];
  assert.equal(demandFits(1, lastUnit, lastUnit), false);
  assert.equal(demandFits(1, lastUnit, []), true);
});

test("a quote header follows the settings until it is frozen, and clearing the settings restores the original header", () => {
  assert.equal(resolveQuoteHeaderImage({ headerImageUrl: null }, { quoteHeaderImageUrl: "/images/entete-devis-palacio.png" }), "/images/entete-devis-palacio.png");
  assert.equal(resolveQuoteHeaderImage({ headerImageUrl: null }, { quoteHeaderImageUrl: "" }), "");
  assert.equal(resolveQuoteHeaderImage({ headerImageUrl: "" }, { quoteHeaderImageUrl: "/images/entete-devis-palacio.png" }), "");
  assert.equal(resolveQuoteHeaderImage({ headerImageUrl: "/images/frozen.png" }, { quoteHeaderImageUrl: "" }), "/images/frozen.png");
  assert.equal(resolveQuoteLogo({ logoSnapshot: null }, { logoUrl: "/images/palacio-logo.png" }), "/images/palacio-logo.png");
  assert.equal(resolveQuoteLogo({ logoSnapshot: "" }, { logoUrl: "/images/palacio-logo.png" }), "");
  assert.equal(resolveQuoteLogo({ logoSnapshot: "/images/frozen-logo.png" }, { logoUrl: "" }), "/images/frozen-logo.png");
  const logos = { logoUrl: "/primary.png", secondaryLogoUrl: "/secondary.png", tertiaryLogoUrl: "/tertiary.png" };
  assert.equal(logoForVariant(logos, "secondary"), "/secondary.png");
  assert.equal(quoteLogoUrl({ ...logos, quoteLogoVariant: "tertiary" }), "/tertiary.png");
  assert.equal(quoteLogoUrl({ ...logos, quoteLogoVariant: "unknown" }), "/primary.png");
  assert.equal(quoteLogoUrl({ ...logos, quoteLogoVariant: "secondary", secondaryLogoUrl: "" }), "");
  assert.equal(quoteTabIconUrl({ ...logos, quoteLogoVariant: "primary" }), "/tertiary.png");
  assert.equal(quoteTabIconUrl({ ...logos, tertiaryLogoUrl: "", quoteLogoVariant: "secondary" }), "/secondary.png");
  assert.equal(brandImagePath("/api/media/1700000000000-aaaaaaaaaaaaaaaa.png"), "/api/media/1700000000000-aaaaaaaaaaaaaaaa.png");
  assert.equal(brandImagePath("/images/palacio-logo.png"), "/images/palacio-logo.png");
  assert.equal(brandImagePath("/etc/passwd"), "");
  assert.equal(resolveQuoteMonogram({ tertiaryLogoSnapshot: null, status: "new" }, { tertiaryLogoUrl: "/mark.png" }), "/mark.png");
  assert.equal(resolveQuoteMonogram({ tertiaryLogoSnapshot: "", status: "quote_sent" }, { tertiaryLogoUrl: "/mark.png" }), "");
  assert.equal(resolveQuoteMonogram({ tertiaryLogoSnapshot: null, status: "quote_sent" }, { tertiaryLogoUrl: "/mark.png" }), "");
  assert.equal(resolveQuoteMonogram({ tertiaryLogoSnapshot: "/frozen-mark.png", status: "accepted" }, { tertiaryLogoUrl: "" }), "/frozen-mark.png");
  assert.equal(emailLogoAddress("/images/palacio-logo.png", "http://localhost:3000"), "http://localhost:3000/images/palacio-logo.png");
  assert.equal(emailLogoAddress("/images/palacio-logo.png", ""), "");
  const emailParts = { eyebrow: "MESSAGE", title: "Merci", greeting: "Bonjour,", body: "Reçu.", detail: "<strong>Sujet</strong>", footer: "À bientôt.", hotelName: "Palacio", address: "Douala", phone: "+237", email: "bonjour@palaciohotel.com" };
  assert.match(themedEmailHtml("forest", emailParts, null, "https://hotel.example/images/palacio-logo.png"), /https:\/\/hotel\.example\/images\/palacio-logo\.png/);
  assert.match(themedEmailHtml("forest", emailParts), /PALACIO/);
  assert.equal(emailLogoDelivery("/images/palacio-logo.png", "http://localhost:3000"), "");
  assert.equal(emailLogoDelivery("http://localhost:3000/images/palacio-logo.png"), "");
  assert.equal(emailLogoDelivery("https://hotel.example/logo.png"), "https://hotel.example/logo.png");
  const localBrand = themedEmailHtml("forest", emailParts, null, emailLogoDelivery("/images/palacio-logo.png", "http://localhost:3000"));
  assert.doesNotMatch(localBrand, /cid:|palacio-logo\.png/);
  assert.match(localBrand, /PALACIO/);
  const unreachableLogo = themedEmailHtml("forest", emailParts, null, "http://localhost:3000/images/palacio-logo.png");
  assert.doesNotMatch(unreachableLogo, /localhost/);
  assert.match(unreachableLogo, /PALACIO/);
  const stayDate = mailDate("2026-09-26", "fr");
  assert.match(stayDate, /2026/);
  assert.doesNotMatch(stayDate, /2026-09-26/);
  const bookingDetail = bookingMailDetail({ reference: "RES-2026-00001", itemName: "Suite Signature", checkIn: "2026-09-26", checkOut: "2026-09-28", guests: 2, quantity: 1, total: 150000, locale: "fr", paymentMethod: "card", paymentStatus: "unpaid" });
  assert.match(bookingDetail, /Suite Signature/);
  assert.match(bookingDetail, /2 personnes/);
  assert.match(bookingDetail, /Paiement par carte/);
  assert.match(bookingDetail, /Non payé/);
  assert.match(bookingDetail, new RegExp(stayDate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(bookingDetail, /2026-09-26/);
  assert.doesNotMatch(bookingDetail, />card</);
  const unpaidNotice = cancellationNotice({ paymentStatus: "unpaid", locale: "fr" });
  assert.match(unpaidNotice, /Aucun paiement/);
  assert.doesNotMatch(unpaidNotice, /remboursement/);
  assert.match(cancellationNotice({ paymentStatus: "paid", locale: "fr" }), /remboursement/);
  const guestCancel = guestCancellationCopy({ paymentStatus: "unpaid", locale: "fr" }, "guest");
  assert.match(guestCancel.body, /confirmons l’annulation/);
  assert.doesNotMatch(guestCancel.body, /L’hôtel a annulé/);
  assert.doesNotMatch(guestCancel.footer, /remboursement/);
  const hotelCancel = guestCancellationCopy({ paymentStatus: "paid", locale: "fr" }, "hotel");
  assert.match(hotelCancel.body, /L’hôtel a annulé/);
  assert.doesNotMatch(hotelCancel.body, /depuis son espace/);
  assert.match(hotelCancel.footer, /remboursement/);
  assert.equal(requestKindLabel("accommodation", "fr"), "Hébergement");
  const quoteDetail = quoteMailDetail({ reference: "DEV-2026-00001", requestKind: "accommodation", people: 3, checkIn: "2026-09-26", checkOut: "2026-09-28", amountTtc: 100000, locale: "fr", validUntil: "2026-10-01" });
  assert.match(quoteDetail, /Hébergement/);
  assert.match(quoteDetail, /3 personnes/);
  assert.doesNotMatch(quoteDetail, /accommodation/);
  const namedQuote = quoteMailDetail({ reference: "DEV-2026-00002", requestKind: "mixed", people: 2, checkIn: "2026-09-26", checkOut: "2026-09-28", amountTtc: null, locale: "fr", validUntil: null, selectedItems: [{ property_id: 1, type: "accommodation", name_fr: "Suite Signature", name_en: "Signature Suite", price: 90000, quantity: 1 }] });
  assert.match(namedQuote, /Suite Signature/);
  assert.match(namedQuote, /Expérience sur mesure/);
  assert.doesNotMatch(namedQuote, /mixed/);
  assert.doesNotMatch(quoteDetail, /2026-09-26/);
});

test("a quote header image stays inside the page and an empty header keeps the same document", async () => {
  const request = { ...quote([restaurant()]), pdfTemplateVersion: 3, status: "new" as const };
  const plain = await buildQuotePdfV3(request, settings, "quote");
  const directory = join(process.cwd(), "public", "uploads", "media");
  const filename = "quote-header-regression.png";
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  try {
    const withHeader = await buildQuotePdfV3(request, { ...settings, quoteHeaderImageUrl: `/api/media/${filename}` }, "quote");
    const plainDoc = await PDFDocument.load(plain);
    const headerDoc = await PDFDocument.load(withHeader);
    assert.equal(plainDoc.getPageCount(), headerDoc.getPageCount());
    assert.equal(headerDoc.getPages()[0].getSize().width, 595);
    assert.equal(headerDoc.getPages()[0].getSize().height, 842);
    const pdfText = (bytes: Uint8Array) => {
      const raw = Buffer.from(bytes);
      const parts = [raw.toString("latin1")];
      let offset = 0;
      while (offset < raw.length) {
        const start = raw.indexOf("stream", offset);
        if (start < 0) break;
        let dataStart = start + 6;
        if (raw[dataStart] === 13) dataStart += 1;
        if (raw[dataStart] === 10) dataStart += 1;
        const end = raw.indexOf("endstream", dataStart);
        if (end < 0) break;
        try { parts.push(inflateSync(raw.subarray(dataStart, end - (raw[end - 1] === 10 ? 1 : 0))).toString("latin1")); } catch { /* image or uncompressed */ }
        offset = end + 9;
      }
      return parts.join("\n");
    };
    const plainText = pdfText(plain);
    const headerText = pdfText(withHeader);
    const hex = (value: string) => Buffer.from(value, "latin1").toString("hex");
    assert.equal(plainText.includes("/Image"), false);
    assert.equal(headerText.includes("/Image"), true);
    assert.equal(plainText.includes("96 96 l"), true);
    assert.equal(plainText.toLowerCase().includes(hex("Bonanjo")), true);
    assert.equal(plainText.toLowerCase().includes(hex("+237 699 00 00 00")), true);
    assert.equal(plainText.toLowerCase().includes(hex("DEVIS")), true);
    assert.equal(plainText.toLowerCase().includes(hex("bonjour@palaciohotel.com")), true);
    assert.equal(headerText.toLowerCase().includes(hex("Bonanjo")), false);
    assert.equal(headerText.toLowerCase().includes(hex("DEVIS")), false);
    const receipt = pdfText(await buildQuotePdfV3(request, { ...settings, quoteHeaderImageUrl: `/api/media/${filename}` }, "receipt")).toLowerCase();
    const plainReceipt = pdfText(await buildQuotePdfV3(request, settings, "receipt")).toLowerCase();
    assert.equal(plainReceipt.includes(hex("ACCUSÉ")), true);
    assert.equal(plainReceipt.includes(hex("bonjour@palaciohotel.com")), true);
    assert.equal(receipt.includes(hex("ACCUSÉ")), false);
    assert.equal(receipt.includes(hex("Bonanjo")), false);
  } finally {
    await rm(join(directory, filename), { force: true });
  }
});

test("a hotel logo sits on the theme plate and keeps the quote identity", async () => {
  const request = { ...quote([restaurant()]), pdfTemplateVersion: 3, status: "new" as const };
  const directory = join(process.cwd(), "public", "uploads", "media");
  const filename = "quote-logo-regression.png";
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  try {
    const bytes = await buildQuotePdfV3(request, { ...settings, logoUrl: `/api/media/${filename}` }, "quote");
    const raw = Buffer.from(bytes);
    const parts = [raw.toString("latin1")];
    let offset = 0;
    while (offset < raw.length) {
      const start = raw.indexOf("stream", offset);
      if (start < 0) break;
      let dataStart = start + 6;
      if (raw[dataStart] === 13) dataStart += 1;
      if (raw[dataStart] === 10) dataStart += 1;
      const end = raw.indexOf("endstream", dataStart);
      if (end < 0) break;
      try { parts.push(inflateSync(raw.subarray(dataStart, end - (raw[end - 1] === 10 ? 1 : 0))).toString("latin1")); } catch { /* image */ }
      offset = end + 9;
    }
    const text = parts.join("\n");
    const mark = "quote-mark-regression.png";
    await writeFile(join(directory, mark), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGPgEpH7D8IMMAYAJowE7aLIR4MAAAAASUVORK5CYII=", "base64"));
    const single = await buildQuotePdfV3(request, { ...settings, logoUrl: `/api/media/${filename}`, tertiaryLogoUrl: `/api/media/${mark}` }, "quote");
    const singleText = Buffer.from(single).toString("latin1");
    assert.equal(text.includes("/Image"), true);
    assert.equal(text.includes("96 96 l"), true);
    assert.equal(text.includes("1 1 1 rg"), true);
    assert.equal(singleText.includes("/Width 2"), true);
    assert.equal(singleText.includes("/Width 1"), false);
    const document = await PDFDocument.load(bytes);
    assert.equal(document.getPageCount(), 1);
    assert.equal(document.getPages()[0].getSize().width, 595);
    assert.equal(document.getPages()[0].getSize().height, 842);
  } finally {
    await rm(join(directory, filename), { force: true });
    await rm(join(directory, "quote-mark-regression.png"), { force: true });
  }
});

test("the Palacio header sample stays fully visible inside the quote band", async () => {
  const file = join(process.cwd(), "public", "images", "entete-devis-palacio.png");
  const bytes = await readFile(file);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(width, 2400);
  assert.equal(height, 360);
  const v3 = containInBox({ width, height }, { x: 48, y: 722, width: 499, height: 72 });
  const v2 = containInBox({ width, height }, { x: 0, y: 730, width: 595, height: 112 });
  assert.ok(v3.width <= 499 && v3.height <= 72);
  assert.ok(v3.x >= 48 && v3.y >= 722);
  assert.ok(v2.width <= 595 && v2.height <= 112);
  const request = { ...quote([restaurant()]), pdfTemplateVersion: 3, status: "new" as const };
  const pdf = await buildQuotePdfV3(request, { ...settings, quoteHeaderImageUrl: "/images/entete-devis-palacio.png" }, "quote");
  const document = await PDFDocument.load(pdf);
  assert.equal(document.getPages()[0].getSize().width, 595);
  assert.equal(document.getPages()[0].getSize().height, 842);
  assert.equal(Buffer.from(pdf).toString("latin1").includes("/Image"), true);
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

test("hotel signature and stamp appear only after they are stored on the quote", async () => {
  const directory = join(process.cwd(), "public", "uploads", "media");
  const signatureFile = "quote-admin-signature-regression.png";
  const stampFile = "quote-admin-stamp-regression.png";
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, signatureFile), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  await writeFile(join(directory, stampFile), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGPgEpH7D8IMMAYAJowE7aLIR4MAAAAASUVORK5CYII=", "base64"));
  const prepared = {
    ...settings,
    quoteSignatureUrl: `/api/media/${signatureFile}`,
    quoteStampUrl: `/api/media/${stampFile}`,
    quoteSignerName: "Amin Palacio",
    quoteSignerRole: "Direction",
  };
  const pdfText = (bytes: Uint8Array) => {
    const raw = Buffer.from(bytes);
    const parts = [raw.toString("latin1")];
    let offset = 0;
    while (offset < raw.length) {
      const start = raw.indexOf("stream", offset);
      if (start < 0) break;
      let dataStart = start + 6;
      if (raw[dataStart] === 13) dataStart += 1;
      if (raw[dataStart] === 10) dataStart += 1;
      const end = raw.indexOf("endstream", dataStart);
      if (end < 0) break;
      try { parts.push(inflateSync(raw.subarray(dataStart, end - (raw[end - 1] === 10 ? 1 : 0))).toString("latin1")); } catch { /* image or uncompressed */ }
      offset = end + 9;
    }
    return parts.join("\n").toLowerCase();
  };
  const encoded = (value: string) => Buffer.from(value, "latin1").toString("hex");
  try {
    const draft = { ...quote([restaurant()]), status: "new" as const };
    const draftModel = buildQuoteDocumentModel(draft, prepared, "quote");
    assert.equal(draftModel.signatures.adminName, "");
    assert.equal(draftModel.signatures.adminRole, "");
    for (const version of [2, 3] as const) {
      const bytes = version === 2
        ? await buildQuotePdfV2({ ...draft, pdfTemplateVersion: 2 }, prepared, "quote")
        : await buildQuotePdfV3({ ...draft, pdfTemplateVersion: 3 }, prepared, "quote");
      const text = pdfText(bytes);
      assert.equal(text.includes("/width 1"), false, `v${version} draft signature`);
      assert.equal(text.includes("/width 2"), false, `v${version} draft stamp`);
      assert.equal(text.includes(encoded("Amin Palacio")), false, `v${version} draft signer`);
      assert.equal(text.includes(encoded("Signature de l'hôtel en attente")), true, `v${version} draft pending`);
    }
    const receipt = pdfText(await buildQuotePdfV3({ ...draft, pdfTemplateVersion: 3 }, prepared, "receipt"));
    assert.equal(receipt.includes("/width 1"), false);
    assert.equal(receipt.includes("/width 2"), false);

    const sent = {
      ...quote([restaurant()]),
      status: "quote_sent" as const,
      amountTtc: 40000,
      validUntil: "2027-02-01",
      adminSignatureUrl: `/api/media/${signatureFile}`,
      adminStampUrl: `/api/media/${stampFile}`,
      adminSignerName: "Amin Palacio",
      adminSignerRole: "Direction",
      adminSignedAt: new Date("2026-09-25T10:00:00Z"),
    };
    const sentModel = buildQuoteDocumentModel(sent, { ...prepared, quoteSignerName: "Autre nom", quoteSignerRole: "Autre rôle" }, "quote");
    assert.equal(sentModel.signatures.adminName, "Amin Palacio");
    assert.equal(sentModel.signatures.adminRole, "Direction");
    const signedV2 = pdfText(await buildQuotePdfV2({ ...sent, pdfTemplateVersion: 2 }, prepared, "quote"));
    const signedV3 = pdfText(await buildQuotePdfV3({ ...sent, pdfTemplateVersion: 3 }, prepared, "quote"));
    for (const [version, text] of [["v2", signedV2], ["v3", signedV3]] as const) {
      assert.equal(text.includes("/width 1"), true, `${version} signature`);
      assert.equal(text.includes("/width 2"), true, `${version} stamp`);
      assert.equal(text.includes(encoded("Amin Palacio")), true, `${version} signer`);
      assert.equal(text.includes(encoded("Signature de l'hôtel en attente")), false, `${version} pending`);
    }
    assert.equal(signedV3.includes(encoded("Direction")), true);
  } finally {
    await rm(join(directory, signatureFile), { force: true });
    await rm(join(directory, stampFile), { force: true });
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

test("Gemini chat uses the OpenAI-compatible path without an extra /v1", () => {
  assert.equal(chatCompletionsUrl("https://generativelanguage.googleapis.com/v1beta/openai", "gemini"), "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  assert.equal(chatCompletionsUrl("https://generativelanguage.googleapis.com/v1beta/openai/v1", "gemini"), "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  assert.equal(chatCompletionsUrl("", "openai"), "https://api.openai.com/v1/chat/completions");
  assert.equal(chatCompletionsUrl("https://api.openai.com", "auto"), "https://api.openai.com/v1/chat/completions");
  const gemini = resolveAiConfig({ aiProvider: "gemini", aiBaseUrl: "", aiModel: "", aiApiKey: "page-key" }, { AI_PROVIDER: "openai", AI_API_KEY: "env-key", AI_BASE_URL: "https://api.openai.com", AI_MODEL: "gpt-4o-mini" }, "chat");
  assert.equal(gemini.provider, "gemini");
  assert.equal(gemini.key, "page-key");
  assert.equal(gemini.baseUrl, "https://generativelanguage.googleapis.com/v1beta/openai");
  assert.equal(gemini.model, "gemini-3.8-flash");
  assert.equal(chatCompletionsUrl(gemini.baseUrl, gemini.provider), "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  const autoChat = resolveAiConfig({ aiProvider: "auto", aiBaseUrl: "", aiModel: "", aiApiKey: "" }, { AI_PROVIDER: "openai", AI_API_KEY: "env-key", AI_BASE_URL: "https://api.openai.com", AI_MODEL: "gpt-4o-mini" }, "chat");
  assert.equal(autoChat.provider, "openai");
  assert.equal(autoChat.key, "env-key");
  assert.equal(chatCompletionsUrl(autoChat.baseUrl, autoChat.provider), "https://api.openai.com/v1/chat/completions");
  const autoQuote = resolveAiConfig({ aiProvider: "auto", aiBaseUrl: "https://hotel.example/v1", aiModel: "hotel-model", aiApiKey: "" }, { AI_PROVIDER: "ollama", AI_API_KEY: "env-key", AI_BASE_URL: "http://127.0.0.1:11434", AI_MODEL: "llama3.2" }, "quote");
  assert.equal(autoQuote.provider, "auto");
  assert.equal(autoQuote.key, "env-key");
  assert.equal(autoQuote.baseUrl, "https://hotel.example/v1");
  assert.equal(autoQuote.model, "hotel-model");
});

test("an AI configuration test reaches Gemini without returning the key", async () => {
  let called = "";
  let authorization = "";
  const verified = await probeAi({
    settings: { aiProvider: "gemini", aiBaseUrl: "", aiModel: "", aiApiKey: "page-secret-key" },
    env: {},
    fetchImpl: async (url, init) => {
      called = String(url);
      authorization = String(new Headers(init?.headers).get("authorization") || "");
      const body = JSON.parse(String(init?.body || "{}"));
      assert.equal(body.max_tokens >= 64, true);
      assert.equal(body.reasoning_effort, "low");
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 });
    },
  });
  assert.equal(called, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  assert.equal(authorization, "Bearer page-secret-key");
  assert.equal(verified.code, "verified");
  assert.equal(JSON.stringify(verified).includes("page-secret-key"), false);
  let openaiUrl = "";
  await probeAi({
    settings: { aiProvider: "openai", aiBaseUrl: "", aiModel: "gpt-4o-mini", aiApiKey: "sk-test-key" },
    env: {},
    fetchImpl: async (url, init) => {
      openaiUrl = String(url);
      const body = JSON.parse(String(init?.body || "{}"));
      assert.equal(body.max_tokens, 16);
      assert.equal(body.reasoning_effort, undefined);
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 });
    },
  });
  assert.equal(openaiUrl, "https://api.openai.com/v1/chat/completions");
  const failed = await probeAi({
    settings: { aiProvider: "gemini", aiApiKey: "page-secret-key" },
    env: {},
    fetchImpl: async () => new Response("rejected page-secret-key", { status: 401 }),
  });
  assert.equal(failed.code, "failed");
  assert.equal(JSON.stringify(failed).includes("page-secret-key"), false);
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response("no"); };
  assert.equal((await probeAi({ settings: { aiProvider: "local" }, env: { AI_API_KEY: "env-key" }, fetchImpl })).code, "local");
  assert.equal((await probeAi({ settings: { aiProvider: "auto", aiApiKey: "" }, env: {}, fetchImpl })).code, "missing");
  assert.equal(calls, 0);
  assert.equal(redactAiError("", "page-secret-key"), "");
});
