import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Booking, HotelSettings } from "@/db/schema";
import { formatXaf } from "@/lib/format";
import { containInBox } from "@/lib/pdf-image-fit";
import { embedAsset } from "@/lib/pdf-quote-v3";
import { resolveQuoteHeaderImage } from "@/lib/quote-header";
import { mergePalette } from "@/lib/quote-pdf-theme";

// Booking PDF template version. Bump when the layout evolves; older bookings keep rendering identically.
export const currentBookingPdfVersion = 2;

const clean = (value: unknown) => String(value ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u0153/g, "oe").replace(/[^\x20-\xFF]/g, " ");

const paymentMethodLabel = (method: string, en: boolean) => ({ card: en ? "Card" : "Carte bancaire", paypal: "PayPal", cash: en ? "To be paid at the hotel" : "À régler à l'hôtel" }[method] || method);
const paymentStatusLabel = (status: string, en: boolean) => ({ unpaid: en ? "Unpaid" : "Non payé", awaiting_payment: en ? "Payment pending" : "Paiement en attente", pay_on_site: en ? "To be paid at the hotel" : "À régler à l'hôtel", paid: en ? "Paid" : "Payé", refunded: en ? "Refunded" : "Remboursé" }[status] || status);
const statusLabel = (status: string, en: boolean) => ({ pending: en ? "Awaiting confirmation" : "En attente de confirmation", confirmed: en ? "Confirmed" : "Confirmée", cancelled: en ? "Cancelled" : "Annulée", checked_in: en ? "Stay in progress" : "Séjour en cours", checked_out: en ? "Stay completed" : "Séjour terminé" }[status] || status);

export async function buildBookingPdf(booking: Booking, settings: HotelSettings, kind: "receipt" | "confirmation" = "receipt") {
  const theme = mergePalette(settings.theme, settings.themeColors);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const hexToRgb = (value: string) => {
    const number = Number.parseInt(value.replace("#", ""), 16);
    return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
  };
  const ink = hexToRgb(theme.ink);
  const muted = hexToRgb(theme.muted);
  const accent = hexToRgb(theme.accent);
  const primary = hexToRgb(theme.primary);
  const width = 595;
  const height = 842;
  const left = 48;
  const right = 547;
  const isEn = booking.locale === "en";
  let page = pdf.addPage([width, height]);
  let y = height - 48;
  const nextPage = () => { page = pdf.addPage([width, height]); y = height - 48; };
  const room = (space: number) => { if (y - space < 58) nextPage(); };
  const textWidth = (value: string, size: number, font: PDFFont) => font.widthOfTextAtSize(clean(value), size);
  const draw = (value: unknown, x: number, size: number, font: PDFFont, paint = ink, maxWidth = right - x) => {
    const words = clean(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, font) > maxWidth && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (!lines.length) lines.push("");
    for (const row of lines) {
      room(size + 4);
      page.drawText(row, { x, y, size, font, color: paint });
      y -= size + 4;
    }
  };
  const placeRight = (value: string, size: number, font: PDFFont, top: number, paint = ink) => page.drawText(value, { x: right - textWidth(value, size, font), y: top, size, font, color: paint });

  // Header identical to the quote PDFs: the configured header image, otherwise the logo plate.
  const headerImage = await embedAsset(pdf, resolveQuoteHeaderImage({}, settings));
  const plate = headerImage ? null : await embedAsset(pdf, settings.tertiaryLogoUrl) || await embedAsset(pdf, settings.logoUrl);
  const reference = clean(booking.reference || `RES-${booking.id}`);
  const dated = new Date(booking.createdAt).toLocaleDateString(isEn ? "en-GB" : "fr-FR");
  const title = kind === "confirmation" ? (isEn ? "CONFIRMATION" : "CONFIRMATION") : (isEn ? "RECEIPT" : "REÇU");

  if (headerImage) {
    const box = { x: left, y: y - 72, width: right - left, height: 72 };
    page.drawImage(headerImage, containInBox(headerImage, box));
    y = box.y - 16;
  } else {
    const square = 96;
    const headerTop = y;
    const ruleY = headerTop - square;
    const textX = left + square + 16;
    const contacts = [settings.addressFr, settings.phone, settings.email].filter(Boolean).map((value) => clean(value));
    const nameY = headerTop - 22;
    const lastY = ruleY + 16;
    const contactTop = nameY - 20;
    const step = contacts.length > 1 ? (contactTop - lastY) / (contacts.length - 1) : 0;
    page.drawRectangle({ x: left, y: ruleY, width: square, height: square, color: rgb(1, 1, 1) });
    if (plate) {
      const inset = 12;
      page.drawImage(plate, containInBox(plate, { x: left + inset, y: ruleY + inset, width: square - inset * 2, height: square - inset * 2 }));
    } else {
      const mark = (clean(settings.hotelName).trim().charAt(0) || "P").toUpperCase();
      const markSize = 32;
      page.drawText(mark, { x: left + (square - textWidth(mark, markSize, bold)) / 2, y: ruleY + (square - markSize) / 2 + 6, size: markSize, font: bold, color: primary });
    }
    const titleWidth = textWidth(title, 16, bold);
    page.drawText(clean(settings.hotelName), { x: textX, y: nameY, size: 15, font: bold, color: primary, maxWidth: Math.max(90, right - titleWidth - 18 - textX) });
    contacts.forEach((line, index) => page.drawText(line, { x: textX, y: contactTop - index * step, size: 9, font: regular, color: muted }));
    placeRight(title, 16, bold, nameY, primary);
    placeRight(reference, 9, regular, contacts.length ? contactTop - step * Math.floor((contacts.length - 1) / 2) : nameY - 18);
    placeRight(dated, 9, regular, lastY, muted);
    page.drawLine({ start: { x: left, y: ruleY - 10 }, end: { x: right, y: ruleY - 10 }, thickness: 1, color: accent });
    y = ruleY - 28;
  }

  draw(kind === "confirmation" ? (isEn ? "YOUR BOOKING CONFIRMATION" : "VOTRE CONFIRMATION DE RÉSERVATION") : (isEn ? "BOOKING REQUEST RECEIVED" : "ACCUSÉ DE RÉCEPTION DE RÉSERVATION"), left, 13, bold, primary);
  y -= 8;

  draw(isEn ? "PREPARED FOR" : "ÉTABLI POUR", left, 8, bold, accent);
  y -= 2;
  draw(booking.guestName, left, 13, bold, ink);
  draw(`${booking.guestEmail}  ·  ${booking.guestPhone}`, left, 8, regular, muted);
  y -= 10;

  draw(isEn ? "YOUR STAY" : "VOTRE SÉJOUR", left, 8, bold, accent);
  y -= 2;
  draw(booking.itemName, left, 11, bold, ink);
  draw(`${isEn ? "From" : "Du"} ${booking.checkIn} ${isEn ? "to" : "au"} ${booking.checkOut}  ·  ${isEn ? "Guests" : "Personnes"} : ${booking.guests}${booking.quantity > 1 ? `  ·  ${isEn ? "Units" : "Unités"} : ${booking.quantity}` : ""}`, left, 8, regular, muted);
  draw(`${isEn ? "Booking status" : "Statut de la réservation"} : ${statusLabel(booking.status, isEn)}`, left, 8, regular, muted);
  draw(`${isEn ? "Payment method" : "Mode de paiement"} : ${paymentMethodLabel(booking.paymentMethod, isEn)}`, left, 8, regular, muted);
  draw(`${isEn ? "Payment status" : "Statut du paiement"} : ${paymentStatusLabel(booking.paymentStatus, isEn)}`, left, 8, regular, muted);
  if (booking.notes) { y -= 6; draw(isEn ? "NOTES" : "NOTES", left, 8, bold, accent); draw(booking.notes.slice(0, 600), left, 8, regular, muted); }

  y -= 18;
  if (kind === "confirmation" && ["confirmed", "checked_in", "checked_out"].includes(booking.status)) {
    room(72);
    page.drawRectangle({ x: left, y: y - 53, width: right - left, height: 68, color: hexToRgb(theme.border) });
    page.drawText(isEn ? "TOTAL AMOUNT (TAX INCLUDED)" : "MONTANT TOTAL TTC", { x: left + 18, y: y - 5, size: 10, font: bold, color: primary });
    page.drawText(clean(formatXaf(booking.total, booking.locale)), { x: left + 18, y: y - 32, size: 20, font: bold, color: primary });
    y -= 86;
    draw(isEn ? "Your stay is confirmed. We look forward to welcoming you at the dates above." : "Votre séjour est confirmé. Nous vous attendons aux dates indiquées.", left, 8, regular, muted);
  } else {
    draw(isEn ? "Thank you for your request. Our team will confirm availability shortly. No payment is due at this stage." : "Merci pour votre demande. Notre équipe vous confirmera la disponibilité dans les meilleurs délais. Aucun paiement n'est demandé à ce stade.", left, 8, regular, muted);
  }

  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].drawLine({ start: { x: left, y: 54 }, end: { x: right, y: 54 }, thickness: 0.6, color: accent });
    pages[i].drawText(clean(`${settings.hotelName}  |  ${settings.email}  |  ${settings.phone}`), { x: left, y: 38, size: 8, font: regular, color: muted });
    pages[i].drawText(`${i + 1}/${pages.length}`, { x: right - 30, y: 38, size: 8, font: regular, color: muted });
  }
  return pdf.save();
}
