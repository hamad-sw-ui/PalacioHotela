import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { HotelSettings, QuoteRequest } from "@/db/schema";
import { formatXaf } from "@/lib/format";
import { containInBox } from "@/lib/pdf-image-fit";
import { resolveQuoteHeaderImage } from "@/lib/quote-header";
import { buildQuoteDocumentModel } from "@/lib/quote-document-model";
import { mergePalette } from "@/lib/quote-pdf-theme";

const clean = (value: unknown) => String(value ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u0153/g, "oe").replace(/[^\x20-\xFF]/g, " ");

function color(value: string) {
  const number = Number.parseInt(value.replace("#", ""), 16);
  return rgb(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255);
}

export async function embedAsset(pdf: PDFDocument, url: string | null | undefined) {
  if (!url) return null;
  try {
    const bytes = url.startsWith("http")
      ? new Uint8Array(await (await fetch(url)).arrayBuffer())
      : url.startsWith("/")
        ? new Uint8Array(await readFile(join(process.cwd(), url.startsWith("/api/media/") ? `public/uploads/media/${url.slice("/api/media/".length)}` : `public${url}`)))
        : null;
    if (!bytes) return null;
    if (/\.png(?:\?|$)/i.test(url)) return await pdf.embedPng(bytes);
    if (/\.jpe?g(?:\?|$)/i.test(url)) return await pdf.embedJpg(bytes);
  } catch { return null; }
  return null;
}

/**
 * Version 3 is a plain A4 quote: white page, one accent rule, the same data.
 * Versions 1 and 2 keep their own renderers.
 */
export async function buildQuotePdfV3(quote: QuoteRequest, settings: HotelSettings, kind: "receipt" | "quote") {
  const model = buildQuoteDocumentModel(quote, settings, kind);
  const theme = mergePalette(settings.theme, settings.themeColors);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = color(theme.ink);
  const muted = color(theme.muted);
  const accent = color(theme.accent);
  const primary = color(theme.primary);
  const border = color(theme.border);
  const width = 595;
  const height = 842;
  const left = 48;
  const right = 547;
  const isEn = model.isEn;
  let page = pdf.addPage([width, height]);
  let y = height - 48;

  const headerImage = await embedAsset(pdf, resolveQuoteHeaderImage(quote, settings));
  const plate = headerImage ? null : (await embedAsset(pdf, settings.tertiaryLogoUrl) || await embedAsset(pdf, settings.logoUrl));
  const logoPlate = rgb(1, 1, 1);
  const clientSignature = await embedAsset(pdf, quote.clientSignatureUrl);
  const adminSignature = await embedAsset(pdf, quote.adminSignatureUrl);
  const adminStamp = await embedAsset(pdf, quote.adminStampUrl);

  const newPage = () => { page = pdf.addPage([width, height]); y = height - 48; };
  const room = (space: number) => { if (y - space < 58) newPage(); };
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

  if (headerImage) {
    const box = { x: left, y: y - 72, width: right - left, height: 72 };
    page.drawImage(headerImage, containInBox(headerImage, box));
    y = box.y - 16;
  } else {
    const square = 96;
    const headerTop = y;
    const ruleY = headerTop - square;
    const textX = left + square + 16;
    const title = clean(kind === "receipt" ? (isEn ? "ACKNOWLEDGEMENT" : "ACCUSÉ") : (isEn ? "QUOTE" : "DEVIS"));
    const reference = clean(model.reference);
    const dated = new Date(model.createdAt).toLocaleDateString(isEn ? "en-GB" : "fr-FR");
    const contacts = [model.hotel.address, model.hotel.phone, model.hotel.email].filter(Boolean).map((value) => clean(value));
    const nameY = headerTop - 22;
    const lastY = ruleY + 16;
    const contactTop = nameY - 20;
    const step = contacts.length > 1 ? (contactTop - lastY) / (contacts.length - 1) : 0;
    const placeRight = (value: string, size: number, font: PDFFont, top: number, paint = ink) => page.drawText(value, { x: right - textWidth(value, size, font), y: top, size, font, color: paint });
    page.drawRectangle({ x: left, y: ruleY, width: square, height: square, color: logoPlate });
    if (plate) {
      const inset = 12;
      page.drawImage(plate, containInBox(plate, { x: left + inset, y: ruleY + inset, width: square - inset * 2, height: square - inset * 2 }));
    } else {
      const mark = (clean(model.hotel.name).trim().charAt(0) || "P").toUpperCase();
      const markSize = 32;
      page.drawText(mark, { x: left + (square - textWidth(mark, markSize, bold)) / 2, y: ruleY + (square - markSize) / 2 + 6, size: markSize, font: bold, color: primary });
    }
    const titleWidth = textWidth(title, 16, bold);
    page.drawText(clean(model.hotel.name), { x: textX, y: nameY, size: 15, font: bold, color: primary, maxWidth: Math.max(90, right - titleWidth - 18 - textX) });
    contacts.forEach((line, index) => page.drawText(line, { x: textX, y: contactTop - index * step, size: 9, font: regular, color: muted }));
    placeRight(title, 16, bold, nameY, primary);
    placeRight(reference, 9, regular, contacts.length ? contactTop - step * Math.floor((contacts.length - 1) / 2) : nameY - 18);
    placeRight(dated, 9, regular, lastY, muted);
    page.drawLine({ start: { x: left, y: ruleY - 10 }, end: { x: right, y: ruleY - 10 }, thickness: 1, color: accent });
    y = ruleY - 28;
  }

  const columnTop = y;
  page.drawText(isEn ? "CLIENT" : "CLIENT", { x: left, y, size: 8, font: bold, color: accent });
  page.drawText(isEn ? "SUBJECT" : "OBJET", { x: 320, y, size: 8, font: bold, color: accent });
  y -= 16;
  page.drawText(clean(model.client.name), { x: left, y, size: 11, font: bold, color: ink });
  const period = model.project.checkIn ? `${model.project.checkIn}${model.project.checkOut ? ` - ${model.project.checkOut}` : ""}` : (isEn ? "Dates to confirm" : "Dates à confirmer");
  page.drawText(clean(model.project.kind), { x: 320, y, size: 11, font: bold, color: ink });
  y -= 15;
  page.drawText(clean(model.client.company || model.client.email), { x: left, y, size: 8, font: regular, color: muted });
  const guests = model.project.people == null ? (isEn ? "Guests to confirm" : "Nombre de personnes à confirmer") : `${model.project.people} ${isEn ? "guests" : "personnes"}`;
  page.drawText(clean(`${period}  ·  ${guests}`), { x: 320, y, size: 8, font: regular, color: muted });
  y -= 13;
  page.drawText(clean(model.client.company ? `${model.client.email}  ·  ${model.client.phone}` : model.client.phone), { x: left, y, size: 8, font: regular, color: muted });
  y = Math.min(y, columnTop - 58);

  const columns = [left, 266, 310, 382, 463];
  const headers = isEn ? ["Description", "Qty", "Day", "Unit price", "Total amount"] : ["Désignation", "Qté", "Jour", "Prix unitaire", "Montant total"];
  room(28);
  headers.forEach((header, index) => page.drawText(header, { x: columns[index], y, size: 8, font: bold, color: primary }));
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: border });
  y -= 16;

  if (!model.lines.length) draw(isEn ? "No service selected" : "Aucune prestation sélectionnée", left, 9, regular, muted);
  for (const line of model.lines) {
    const detail = [line.dates, line.meals, line.parent].filter(Boolean).join(" · ");
    room(detail ? 30 : 18);
    page.drawText(clean(line.name).slice(0, 42), { x: columns[0], y, size: 9, font: bold, color: ink });
    page.drawText(String(line.quantity), { x: columns[1], y, size: 9, font: regular, color: ink });
    page.drawText(String(line.units), { x: columns[2], y, size: 8, font: regular, color: muted });
    const unitPrice = line.quantity > 0 ? Math.round(line.total / line.quantity) : line.total;
    page.drawText(clean(formatXaf(unitPrice, model.locale)), { x: columns[3], y, size: 8, font: regular, color: ink });
    page.drawText(clean(formatXaf(line.total, model.locale)), { x: columns[4], y, size: 8, font: bold, color: ink });
    y -= 12;
    if (detail) { page.drawText(clean(detail).slice(0, 90), { x: columns[0], y, size: 7.5, font: regular, color: muted }); y -= 12; }
    page.drawLine({ start: { x: left, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.3, color: border });
    y -= 6;
  }

  room(42);
  y -= 8;
  const totalLabel = kind === "quote" && model.amountTtc ? (isEn ? "Total incl. tax" : "Total TTC") : (isEn ? "Estimate" : "Estimation");
  page.drawText(totalLabel, { x: 390, y, size: 9, font: regular, color: muted });
  page.drawText(clean(formatXaf(model.total, model.locale)), { x: 470, y, size: 13, font: bold, color: primary });
  y -= 28;

  if (model.project.message) { draw(isEn ? "Message" : "Message", left, 8, bold, accent); draw(model.project.message.slice(0, 700), left, 8, regular, muted); y -= 6; }
  if (model.terms || model.adminNotes) { draw(isEn ? "Terms" : "Conditions", left, 8, bold, accent); if (model.terms) draw(model.terms, left, 8, regular, muted); if (model.adminNotes) draw(model.adminNotes, left, 8, regular, muted); y -= 6; }
  if (model.validUntil && kind === "quote") { room(16); page.drawText(clean(`${isEn ? "Valid until" : "Valable jusqu'au"} : ${model.validUntil}`), { x: left, y, size: 8, font: bold, color: ink }); y -= 20; }

  room(150);
  y -= 8;
  const signatureTop = y;
  const stampSize = 112;
  const stampBox = { x: 412, y: signatureTop - stampSize + 6, width: stampSize, height: stampSize };
  page.drawText(isEn ? "Client signature" : "Signature du client", { x: left, y, size: 8, font: bold, color: ink });
  page.drawText(isEn ? "Hotel signature" : "Signature de l'hôtel", { x: 330, y, size: 8, font: bold, color: ink });
  y -= 8;
  const signatureLine = (target: PDFPage, x: number, top: number, lineWidth: number) => target.drawLine({ start: { x, y: top - 46 }, end: { x: x + lineWidth, y: top - 46 }, thickness: 0.5, color: border });
  signatureLine(page, left, y, 170);
  signatureLine(page, 330, y, 170);
  if (clientSignature) page.drawImage(clientSignature, { x: left, y: y - 40, width: Math.min(120, clientSignature.width), height: 32 });
  if (adminSignature) page.drawImage(adminSignature, { x: 330, y: y - 40, width: Math.min(110, adminSignature.width), height: 30 });
  else page.drawText(clean(isEn ? "Awaiting hotel signature" : "Signature de l'hôtel en attente"), { x: 330, y: y - 25, size: 7, font: regular, color: muted });
  page.drawText(clean(model.signatures.clientName || model.client.name), { x: left, y: y - 60, size: 8, font: regular, color: muted });
  const adminCaption = [model.signatures.adminName, model.signatures.adminRole].filter(Boolean).join(" · ");
  if (adminCaption) page.drawText(clean(adminCaption), { x: 330, y: y - 60, size: 8, font: regular, color: muted, maxWidth: stampBox.x - 338 });
  if (adminStamp) page.drawImage(adminStamp, { ...containInBox(adminStamp, stampBox) });

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawText(clean(`${model.hotel.name}  ·  ${model.reference}`), { x: left, y: 28, size: 7, font: regular, color: muted });
    current.drawText(`${index + 1}/${pages.length}`, { x: right - 18, y: 28, size: 7, font: regular, color: muted });
  });
  return pdf.save();
}
