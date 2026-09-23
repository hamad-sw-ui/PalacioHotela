import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { HotelSettings, QuoteRequest } from "@/db/schema";
import { formatXaf, quoteLineTotal } from "@/lib/hotel";

const clean = (value: unknown) => String(value ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u0153/g, "oe").replace(/[^\x20-\xFF]/g, " ");

export async function buildQuotePdf(quote: QuoteRequest, settings: HotelSettings, kind: "receipt" | "quote") {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.11, 0.24, 0.20);
  const gold = rgb(0.69, 0.51, 0.30);
  const gray = rgb(0.38, 0.43, 0.40);
  const isEn = quote.locale === "en";
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const nextPage = () => { page = pdf.addPage([595, 842]); y = 785; };
  const text = (value: unknown, size = 11, isBold = false, color = green, x = 52) => {
    const font = isBold ? bold : regular;
    const maxWidth = 490;
    const words = clean(value).split(/\s+/);
    let line = "";
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(attempt, size) > maxWidth && line) {
        if (y < 75) nextPage();
        page.drawText(line, { x, y, size, font, color }); y -= size + 7; line = word;
      } else line = attempt;
    }
    if (line) { if (y < 75) nextPage(); page.drawText(line, { x, y, size, font, color }); y -= size + 7; }
  };
  page.drawRectangle({ x: 0, y: 754, width: 595, height: 88, color: green });
  page.drawText("PALACIO", { x: 52, y: 791, size: 24, font: bold, color: rgb(1, 1, 1) });
  page.drawText("H O T E L", { x: 54, y: 772, size: 9, font: regular, color: rgb(0.88, 0.77, 0.59) });
  page.drawText(clean(settings.addressFr), { x: 355, y: 781, size: 9, font: regular, color: rgb(1, 1, 1) });
  y = 712;
  text(kind === "receipt" ? (isEn ? "REQUEST RECEIVED" : "ACCUSÉ DE RÉCEPTION") : (isEn ? "YOUR PERSONALIZED QUOTE" : "VOTRE DEVIS PERSONNALISÉ"), 20, true);
  y -= 4;
  text(`${isEn ? "Reference" : "Référence"} : ${quote.reference || `DEV-${quote.id}`}`, 11, true, gold);
  text(`${isEn ? "Date" : "Date"} : ${new Date(quote.createdAt).toLocaleDateString(isEn ? "en-GB" : "fr-FR")}`, 10, false, gray);
  y -= 24;
  page.drawRectangle({ x: 52, y: y - 8, width: 490, height: 1, color: gold }); y -= 32;
  text(isEn ? "PREPARED FOR" : "ÉTABLI POUR", 10, true, gold);
  text(quote.guestName, 15, true);
  if (quote.company) text(quote.company, 10, false, gray);
  text(quote.guestEmail, 10, false, gray);
  text(quote.guestPhone, 10, false, gray);
  y -= 22;
  text(isEn ? "YOUR REQUEST" : "VOTRE DEMANDE", 10, true, gold);
  const category: Record<string, string> = { accommodation: isEn ? "Accommodation" : "Hébergement", conference_room: isEn ? "Conference room" : "Salle de conférence", event_hall: isEn ? "Event hall" : "Salle de fête", service: isEn ? "Services & leisure" : "Services & loisirs", restaurant: isEn ? "Dining" : "Restauration", mixed: isEn ? "Tailored experience" : "Expérience sur mesure" };
  text(category[quote.requestKind] || quote.requestKind, 14, true);
  if (quote.checkIn) text(`${isEn ? "From" : "Du"} ${quote.checkIn}${quote.checkOut ? ` ${isEn ? "to" : "au"} ${quote.checkOut}` : ""}`, 10, false, gray);
  text(`${isEn ? "Guests" : "Personnes"} : ${quote.people}`, 10, false, gray);
  if (quote.selectedItems.length) {
    y -= 15;
    for (const item of quote.selectedItems.slice(0, 20)) {
      text(`- ${isEn ? item.name_en : item.name_fr} x ${item.quantity}  |  ${formatXaf(quoteLineTotal(item), quote.locale)}`, 10);
    }
  }
  if (quote.message) { y -= 13; text(isEn ? "MESSAGE" : "MESSAGE", 10, true, gold); text(quote.message.slice(0, 600), 10, false, gray); }
  y -= 25;
  if (kind === "quote" && quote.amountTtc != null) {
    if (y < 170) nextPage();
    page.drawRectangle({ x: 52, y: y - 53, width: 490, height: 68, color: rgb(0.94, 0.95, 0.92) });
    page.drawText(isEn ? "TOTAL AMOUNT (TAX INCLUDED)" : "MONTANT TOTAL TTC", { x: 70, y: y - 5, size: 10, font: bold, color: green });
    page.drawText(clean(formatXaf(quote.amountTtc, quote.locale)), { x: 70, y: y - 32, size: 20, font: bold, color: green });
    y -= 86;
    if (quote.validUntil) text(`${isEn ? "Valid until" : "Valable jusqu'au"} : ${quote.validUntil}`, 11, true, gold);
    if (quote.adminNotes) text(quote.adminNotes.slice(0, 500), 10, false, gray);
    y -= 18;
    text(isEn ? "We look forward to welcoming you. Please contact us to confirm your quote." : "Nous serions ravis de vous accueillir. Contactez-nous pour confirmer votre devis.", 10);
  } else {
    text(isEn ? "Thank you for your request. Our team will review it and send you a personalized quote shortly. No payment is due at this stage." : "Merci pour votre demande. Notre équipe l’étudiera et vous adressera prochainement un devis personnalisé. Aucun paiement n’est demandé à ce stade.", 11);
  }
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].drawRectangle({ x: 52, y: 54, width: 490, height: 1, color: gold });
    pages[i].drawText(clean(`${settings.hotelName}  |  ${settings.email}  |  ${settings.phone}`), { x: 52, y: 38, size: 8, font: regular, color: gray });
    pages[i].drawText(`${i + 1}/${pages.length}`, { x: 510, y: 38, size: 8, font: regular, color: gray });
  }
  return pdf.save();
}
