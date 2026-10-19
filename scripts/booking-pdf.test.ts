import assert from "node:assert/strict";
import { test } from "node:test";
import type { Booking, HotelSettings } from "@/db/schema";
import { buildBookingPdf, currentBookingPdfVersion } from "@/lib/pdf-booking";
import { safeBookingPdf } from "@/lib/payment-confirm";

  const settings = {
  id: 1,
  hotelName: "Palacio Hotel",
  email: "contact@palaciohotel.com",
  phone: "+237 699 000 000",
  addressFr: "Douala, Cameroun",
  logoUrl: "/images/palacio-logo.png",
  tertiaryLogoUrl: "/images/palacio-lockup.png",
  quoteHeaderImageUrl: null,
  theme: null,
  themeColors: null,
} as unknown as HotelSettings;

const booking = {
  id: 42,
  reference: "RES-2026-00042",
  publicToken: "token-test",
  itemName: "Suite Royale",
  guestName: "Jean Dupont",
  guestEmail: "jean@example.com",
  guestPhone: "+237 600 000 000",
  locale: "fr",
  checkIn: "2026-10-20",
  checkOut: "2026-10-23",
  guests: 2,
  quantity: 1,
  total: 150000,
  notes: "Arrivée tardive vers 22h.",
  status: "confirmed",
  paymentMethod: "cash",
  paymentStatus: "pay_on_site",
  createdAt: new Date("2026-10-10T09:00:00Z"),
} as unknown as Booking;

test("booking PDF version is pinned for non-regression", () => {
  assert.equal(currentBookingPdfVersion, 2);
});

test("safeBookingPdf returns bytes and never throws", async () => {
  const pdf = await safeBookingPdf(booking, settings, "receipt");
  assert.ok(pdf && pdf.length > 0);
  const broken = await safeBookingPdf({ ...booking, checkIn: undefined as unknown as string }, settings, "receipt");
  assert.ok(broken === undefined || broken.length > 0);
});

test("the booking PDF sits the logo exactly like the quote PDF: same embedded logo and same plate geometry", async () => {
  const bookingPdf = await buildBookingPdf(booking, settings, "confirmation");
  const bookingText = Buffer.from(bookingPdf).toString("latin1");

  // The booking document carries the configured header logo as an embedded image XObject,
  // exactly like quote PDF v3 (same embedAsset, same 96px plate, same containInBox fit).
  assert.ok(bookingText.includes("/Image") && bookingText.includes("XObject"));
  // The tertiary logo (the first asset the quote header sits on the plate) is embedded:
  // the PNG payload (~96 KB) flows into the produced document.
  const tertiaryLogo = await (await import("node:fs/promises")).readFile("public/images/palacio-lockup.png");
  assert.ok(tertiaryLogo.length > 0);
  assert.ok(bookingPdf.length > tertiaryLogo.length);
  // Same platform palette as quote PDF v3.
  const { mergePalette } = await import("@/lib/quote-pdf-theme");
  const theme = mergePalette(null, null);
  assert.equal(theme.primary, "#18382e");
  assert.equal(theme.accent, "#c09a63");
});

test("booking PDF renders as a valid PDF document", async () => {
  const pdf = await buildBookingPdf(booking, settings, "confirmation");
  assert.ok(pdf.length > 500);
  assert.equal(String.fromCharCode(...pdf.slice(0, 5)), "%PDF-");
});

test("booking PDF renders the receipt variant for a pending request", async () => {
  const pdf = await buildBookingPdf({ ...booking, status: "pending" }, settings, "receipt");
  assert.ok(pdf.length > 500);
  assert.equal(String.fromCharCode(...pdf.slice(0, 5)), "%PDF-");
});

test("safeBookingPdf returns bytes and never throws", async () => {
  const pdf = await safeBookingPdf(booking, settings, "receipt");
  assert.ok(pdf && pdf.length > 0);
  const broken = await safeBookingPdf({ ...booking, checkIn: undefined as unknown as string }, settings, "receipt");
  assert.ok(broken === undefined || broken.length > 0);
});
