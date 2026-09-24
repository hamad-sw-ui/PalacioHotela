import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import type { HotelSettings, QuoteRequest, SelectedItem } from "@/db/schema";
import { formatXaf } from "@/lib/format";
import { quoteLineTotal, quoteTotal } from "@/lib/quote-pricing";
import { formatQuoteLineMeta, formatQuoteLineMeals } from "@/lib/quote-line-display";

const clean = (value: unknown) => String(value ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u0153/g, "oe").replace(/[^\x20-\xFF]/g, " ");

type Palette = { primary: ReturnType<typeof rgb>; dark: ReturnType<typeof rgb>; accent: ReturnType<typeof rgb>; accentLight: ReturnType<typeof rgb>; ink: ReturnType<typeof rgb>; muted: ReturnType<typeof rgb>; paper: ReturnType<typeof rgb>; soft: ReturnType<typeof rgb>; border: ReturnType<typeof rgb> };

function hex(value: string) {
  const normalized = value.replace("#", "");
  const number = Number.parseInt(normalized, 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
}

function palette(theme: string): Palette {
  const values = theme === "midnight"
    ? { primary: "#1b303c", dark: "#11242e", accent: "#bf9a68", accentLight: "#dfbe89", ink: "#203744", muted: "#5d6879", paper: "#f7f8f8", soft: "#f0f3f3", border: "#d9e0e0" }
    : theme === "terracotta"
      ? { primary: "#6d3f31", dark: "#512c23", accent: "#c88860", accentLight: "#e2b184", ink: "#533d32", muted: "#76615a", paper: "#fbf8f5", soft: "#f7f0e9", border: "#eaded5" }
      : { primary: "#18382e", dark: "#102d26", accent: "#c09a63", accentLight: "#e0bd83", ink: "#20392f", muted: "#6e786f", paper: "#faf9f5", soft: "#f3f2ed", border: "#dfe6dd" };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, hex(value)])) as Palette;
}

async function assetBytes(url: string | null | undefined) {
  if (!url) return null;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) return new Uint8Array(await (await fetch(url)).arrayBuffer());
    if (url.startsWith("/api/media/")) return new Uint8Array(await readFile(join(process.cwd(), "public", "uploads", "media", url.slice("/api/media/".length))));
    if (url.startsWith("/")) return new Uint8Array(await readFile(join(process.cwd(), "public", url.slice(1))));
  } catch { return null; }
  return null;
}

async function embedAsset(pdf: PDFDocument, url: string | null | undefined) {
  const bytes = await assetBytes(url);
  if (!bytes) return null;
  try {
    if (/\.png(?:\?|$)/i.test(url || "")) return await pdf.embedPng(bytes);
    if (/\.(jpg|jpeg)(?:\?|$)/i.test(url || "")) return await pdf.embedJpg(bytes);
  } catch { return null; }
  return null;
}

export async function buildQuotePdfV2(quote: QuoteRequest, settings: HotelSettings, kind: "receipt" | "quote") {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const colors = palette(settings.theme);
  const width = 595;
  const height = 842;
  const left = 42;
  const right = 553;
  const contentWidth = right - left;
  const logo = await embedAsset(pdf, settings.logoUrl);
  const adminSignature = await embedAsset(pdf, quote.adminSignatureUrl || settings.quoteSignatureUrl);
  const adminStamp = await embedAsset(pdf, quote.adminStampUrl || settings.quoteStampUrl);
  const clientSignature = await embedAsset(pdf, quote.clientSignatureUrl);
  let page = pdf.addPage([width, height]);
  let y = 0;

  const drawHeader = (target: PDFPage) => {
    target.drawRectangle({ x: 0, y: height - 112, width, height: 112, color: colors.primary });
    if (logo) {
      const scale = Math.min(115 / logo.width, 56 / logo.height);
      target.drawImage(logo, { x: left, y: height - 78, width: logo.width * scale, height: logo.height * scale });
    } else {
      target.drawText("PALACIO", { x: left, y: height - 54, size: 25, font: bold, color: rgb(1, 1, 1) });
      target.drawText("H O T E L", { x: left + 2, y: height - 73, size: 8, font: regular, color: colors.accentLight });
    }
    target.drawText(clean(settings.addressFr), { x: 330, y: height - 42, size: 8.5, font: regular, color: rgb(1, 1, 1), maxWidth: 220 });
    target.drawText(clean(`${settings.phone}  ·  ${settings.email}`), { x: 330, y: height - 59, size: 8.5, font: regular, color: colors.accentLight, maxWidth: 220 });
  };
  drawHeader(page);
  y = height - 146;

  const addPage = () => {
    page = pdf.addPage([width, height]);
    y = height - 54;
  };
  const ensure = (space: number) => { if (y - space < 70) addPage(); };
  const drawText = (value: unknown, x = left, size = 9.5, color = colors.ink, font = regular, maxWidth = contentWidth, lineGap = 4) => {
    const words = clean(value).split(/\s+/).filter(Boolean);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(attempt, size) > maxWidth && line) { lines.push(line); line = word; } else line = attempt;
    }
    if (line) lines.push(line);
    for (const row of lines) { ensure(size + lineGap); page.drawText(row, { x, y, size, font, color }); y -= size + lineGap; }
    return lines.length;
  };
  const label = (value: string) => { ensure(16); page.drawText(value, { x: left, y, size: 8, font: bold, color: colors.accent }); y -= 14; };
  const dateLabel = quote.locale === "en" ? "Date" : "Date";
  const isEn = quote.locale === "en";
  const title = kind === "receipt" ? (isEn ? "REQUEST ACKNOWLEDGEMENT" : "ACCUSÉ DE RÉCEPTION") : (isEn ? "PERSONALIZED QUOTE" : "DEVIS PERSONNALISÉ");

  page.drawText(title, { x: left, y, size: 20, font: bold, color: colors.ink });
  y -= 25;
  page.drawText(`${isEn ? "Reference" : "Référence"}  ${quote.reference || `DEV-${quote.id}`}`, { x: left, y, size: 9, font: bold, color: colors.accent });
  page.drawText(`${dateLabel}  ${new Date(quote.createdAt).toLocaleDateString(isEn ? "en-GB" : "fr-FR")}`, { x: 400, y, size: 9, font: regular, color: colors.muted });
  y -= 20;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: colors.accent });
  y -= 22;

  const infoTop = y;
  page.drawRectangle({ x: left, y: infoTop - 66, width: 238, height: 66, color: colors.soft });
  page.drawRectangle({ x: 307, y: infoTop - 66, width: 246, height: 66, color: colors.soft });
  page.drawText(isEn ? "PREPARED FOR" : "ÉTABLI POUR", { x: left + 12, y: infoTop - 17, size: 7.5, font: bold, color: colors.accent });
  page.drawText(clean(quote.guestName), { x: left + 12, y: infoTop - 34, size: 11, font: bold, color: colors.ink, maxWidth: 210 });
  page.drawText(clean(quote.company || quote.guestEmail), { x: left + 12, y: infoTop - 49, size: 8, font: regular, color: colors.muted, maxWidth: 210 });
  page.drawText(clean(quote.company ? quote.guestEmail : quote.guestPhone), { x: left + 12, y: infoTop - 61, size: 8, font: regular, color: colors.muted, maxWidth: 210 });
  page.drawText(isEn ? "PROJECT OVERVIEW" : "VOTRE PROJET", { x: 319, y: infoTop - 17, size: 7.5, font: bold, color: colors.accent });
  page.drawText(clean(quote.requestKind.replaceAll("_", " ")), { x: 319, y: infoTop - 34, size: 11, font: bold, color: colors.ink, maxWidth: 218 });
  const period = quote.checkIn ? `${quote.checkIn}${quote.checkOut ? ` → ${quote.checkOut}` : ""}` : (isEn ? "Dates to be confirmed" : "Dates à confirmer");
  page.drawText(clean(`${period} · ${quote.people} ${isEn ? "guests" : "personnes"}`), { x: 319, y: infoTop - 51, size: 8, font: regular, color: colors.muted, maxWidth: 218 });
  y = infoTop - 91;

  label(isEn ? "SELECTED SERVICES" : "PRESTATIONS SÉLECTIONNÉES");
  const columns = { item: left, details: 245, qty: 410, unit: 450, total: 500 };
  page.drawRectangle({ x: left, y: y - 20, width: contentWidth, height: 22, color: colors.primary });
  page.drawText(isEn ? "ITEM" : "PRESTATION", { x: columns.item + 8, y: y - 14, size: 7.5, font: bold, color: rgb(1, 1, 1) });
  page.drawText(isEn ? "DETAILS" : "DÉTAILS", { x: columns.details, y: y - 14, size: 7.5, font: bold, color: rgb(1, 1, 1) });
  page.drawText(isEn ? "QTY" : "QTÉ", { x: columns.qty, y: y - 14, size: 7.5, font: bold, color: rgb(1, 1, 1) });
  page.drawText(isEn ? "UNIT" : "UNITÉ", { x: columns.unit, y: y - 14, size: 7.5, font: bold, color: rgb(1, 1, 1) });
  page.drawText(isEn ? "TOTAL" : "TOTAL", { x: columns.total, y: y - 14, size: 7.5, font: bold, color: rgb(1, 1, 1) });
  y -= 28;

  const items = quote.selectedItems || [];
  for (const [index, item] of items.entries()) {
    const meta = formatQuoteLineMeta(item, quote.locale as "fr" | "en");
    const meal = item.type === "restaurant" ? formatQuoteLineMeals(item.meal_types, quote.locale as "fr" | "en") : "";
    const detailLines = [meta.replace(/\n/g, " · "), meal].filter(Boolean);
    const rowHeight = Math.max(34, 16 + detailLines.length * 10);
    ensure(rowHeight + 8);
    if (index % 2 === 0) page.drawRectangle({ x: left, y: y - rowHeight + 5, width: contentWidth, height: rowHeight, color: colors.soft });
    page.drawText(clean(isEn ? item.name_en : item.name_fr), { x: columns.item + 8, y: y - 12, size: 8.5, font: bold, color: colors.ink, maxWidth: 185 });
    detailLines.slice(0, 3).forEach((detail, detailIndex) => page.drawText(clean(detail), { x: columns.details, y: y - 12 - detailIndex * 10, size: 7, font: regular, color: colors.muted, maxWidth: 155 }));
    page.drawText(String(item.quantity), { x: columns.qty + 5, y: y - 12, size: 8, font: regular, color: colors.ink });
    page.drawText(item.type === "accommodation" ? (isEn ? "night" : "nuit") : item.type === "restaurant" ? (isEn ? "service" : "service") : (isEn ? "unit" : "unité"), { x: columns.unit, y: y - 12, size: 7, font: regular, color: colors.muted });
    page.drawText(clean(formatXaf(quoteLineTotal(item), quote.locale)), { x: columns.total, y: y - 12, size: 7.5, font: bold, color: colors.ink });
    page.drawLine({ start: { x: left, y: y - rowHeight + 4 }, end: { x: right, y: y - rowHeight + 4 }, thickness: .5, color: colors.border });
    y -= rowHeight;
  }
  if (!items.length) {
    page.drawText(isEn ? "No service selected" : "Aucune prestation sélectionnée", { x: left + 8, y: y - 14, size: 8.5, font: regular, color: colors.muted });
    y -= 35;
  }

  const calculatedTotal = quoteTotal(items);
  const total = quote.amountTtc != null && quote.amountTtc > 0 ? quote.amountTtc : quote.estimatedTotal ?? calculatedTotal;
  ensure(105);
  y -= 18;
  page.drawRectangle({ x: 327, y: y - 70, width: 226, height: 70, color: colors.soft });
  page.drawText(kind === "quote" && quote.amountTtc ? (isEn ? "TOTAL AMOUNT TAX INCLUDED" : "MONTANT TOTAL TTC") : (isEn ? "INDICATIVE ESTIMATE" : "ESTIMATION INDICATIVE"), { x: 343, y: y - 18, size: 7.5, font: bold, color: colors.accent });
  page.drawText(clean(formatXaf(total, quote.locale)), { x: 343, y: y - 45, size: 17, font: bold, color: colors.primary });
  y -= 93;

  if (quote.message) {
    ensure(58);
    label(isEn ? "CLIENT MESSAGE" : "MESSAGE DU CLIENT");
    drawText(quote.message.slice(0, 900), left, 8.5, colors.muted, regular, contentWidth, 3);
    y -= 8;
  }
  const terms = quote.locale === "en" ? quote.termsSnapshotEn || settings.quoteTermsEn : quote.termsSnapshotFr || settings.quoteTermsFr;
  if (terms || quote.adminNotes) {
    ensure(65);
    label(isEn ? "TERMS & CONDITIONS" : "CONDITIONS ET NOTES");
    if (terms) drawText(terms, left, 8, colors.muted, regular, contentWidth, 3);
    if (quote.adminNotes) drawText(quote.adminNotes, left, 8, colors.muted, regular, contentWidth, 3);
  }
  if (quote.validUntil && kind === "quote") {
    ensure(22);
    page.drawText(`${isEn ? "Valid until" : "Valable jusqu'au"} : ${quote.validUntil}`, { x: left, y, size: 8.5, font: bold, color: colors.accent });
    y -= 17;
  }

  ensure(145);
  y -= 12;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: colors.accent });
  y -= 25;
  page.drawText(isEn ? "CLIENT SIGNATURE" : "SIGNATURE DU CLIENT", { x: left + 8, y, size: 7.5, font: bold, color: colors.accent });
  page.drawText(isEn ? "HOTEL SIGNATURE & STAMP" : "SIGNATURE ET CACHET DE L'HÔTEL", { x: 310, y, size: 7.5, font: bold, color: colors.accent });
  y -= 18;
  if (clientSignature) {
    const scale = Math.min(145 / clientSignature.width, 42 / clientSignature.height);
    page.drawImage(clientSignature, { x: left + 10, y: y - 38, width: clientSignature.width * scale, height: clientSignature.height * scale });
  } else {
    page.drawRectangle({ x: left + 8, y: y - 42, width: 200, height: 43, borderColor: colors.border, borderWidth: .7 });
    page.drawText(isEn ? "Awaiting client signature" : "Signature client en attente", { x: left + 17, y: y - 25, size: 7, font: regular, color: colors.muted });
  }
  if (adminSignature) {
    const scale = Math.min(120 / adminSignature.width, 38 / adminSignature.height);
    page.drawImage(adminSignature, { x: 317, y: y - 37, width: adminSignature.width * scale, height: adminSignature.height * scale });
  }
  if (adminStamp) {
    const scale = Math.min(58 / adminStamp.width, 58 / adminStamp.height);
    page.drawImage(adminStamp, { x: 445, y: y - 42, width: adminStamp.width * scale, height: adminStamp.height * scale, opacity: .78 });
  }
  page.drawLine({ start: { x: left + 8, y: y - 48 }, end: { x: left + 208, y: y - 48 }, thickness: .7, color: colors.border });
  page.drawLine({ start: { x: 310, y: y - 48 }, end: { x: right, y: y - 48 }, thickness: .7, color: colors.border });
  page.drawText(clean(quote.clientSignerName || (isEn ? "Client" : "Client")), { x: left + 8, y: y - 61, size: 7.5, font: regular, color: colors.ink });
  page.drawText(clean(quote.adminSignerName || settings.quoteSignerName || settings.hotelName), { x: 310, y: y - 61, size: 7.5, font: regular, color: colors.ink });
  page.drawText(quote.clientSignedAt ? `${isEn ? "Signed" : "Signé"} : ${new Date(quote.clientSignedAt).toLocaleDateString(isEn ? "en-GB" : "fr-FR")}` : (isEn ? "To be signed by client" : "À signer par le client"), { x: left + 8, y: y - 73, size: 7, font: regular, color: colors.muted });
  page.drawText(quote.adminSignedAt ? `${isEn ? "Signed" : "Signé"} : ${new Date(quote.adminSignedAt).toLocaleDateString(isEn ? "en-GB" : "fr-FR")}` : "", { x: 310, y: y - 73, size: 7, font: regular, color: colors.muted });

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: left, y: 44 }, end: { x: right, y: 44 }, thickness: .7, color: colors.border });
    current.drawText(clean(`${settings.hotelName}  ·  ${settings.email}  ·  ${settings.phone}`), { x: left, y: 29, size: 7, font: regular, color: colors.muted });
    current.drawText(`${index + 1}/${pages.length}`, { x: 520, y: 29, size: 7, font: regular, color: colors.muted });
  });
  return pdf.save();
}
