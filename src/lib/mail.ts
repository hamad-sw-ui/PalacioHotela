import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type { Booking, HotelSettings, QuoteRequest } from "@/db/schema";
import { formatXaf } from "@/lib/hotel";

const escapeHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);

function template(settings: HotelSettings, eyebrow: string, title: string, greeting: string, body: string, detail: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f4ee;font-family:Arial,Helvetica,sans-serif;color:#203a30"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:4px;overflow:hidden"><tr><td style="background:#1e3a30;padding:32px 44px;color:#fff"><div style="font-family:Georgia,serif;font-size:28px;letter-spacing:3px">PALACIO</div><div style="font-size:10px;letter-spacing:5px;color:#d7ba88;margin-top:3px">H O T E L</div></td></tr><tr><td style="padding:42px 44px"><div style="color:#af8554;font-size:11px;letter-spacing:2px;font-weight:bold;text-transform:uppercase">${escapeHtml(eyebrow)}</div><h1 style="font-family:Georgia,serif;font-weight:normal;font-size:30px;line-height:1.2;margin:14px 0 22px;color:#203a30">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.8;margin:0 0 16px">${escapeHtml(greeting)}</p><p style="font-size:15px;line-height:1.8;color:#56645d;margin:0 0 22px">${escapeHtml(body)}</p><div style="background:#f5f6f2;border-left:3px solid #bc9361;padding:18px 22px;font-size:14px;line-height:1.9;color:#203a30">${detail}</div><p style="font-size:14px;line-height:1.8;color:#56645d;margin-top:24px">${escapeHtml(footer)}</p></td></tr><tr><td style="background:#f0eee8;padding:23px 44px;color:#6b756e;font-size:12px;line-height:1.7">${escapeHtml(settings.hotelName)} · ${escapeHtml(settings.addressFr)}<br>${escapeHtml(settings.phone)} · ${escapeHtml(settings.email)}</td></tr></table></td></tr></table></body></html>`;
}

export async function sendHotelMail(to: string, subject: string, html: string, settings: HotelSettings, attachments?: Mail.Attachment[]) {
  if (!process.env.SMTP_HOST) { console.info(`[Palacio] SMTP not configured; email queued in-app: ${subject}`); return false; }
  try {
    const port = Number(process.env.SMTP_PORT || "587");
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: process.env.SMTP_SECURE === "true" || port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" } : undefined, requireTLS: port !== 465 && process.env.SMTP_REQUIRE_TLS === "true" });
    await transporter.sendMail({ from: process.env.SMTP_FROM || `"${settings.hotelName}" <${process.env.SMTP_USER || settings.email}>`, to, subject, html, attachments });
    return true;
  } catch (error) { console.error("[Palacio] SMTP delivery failed:", error); return false; }
}

export async function sendBookingEmails(booking: Booking, settings: HotelSettings) {
  const en = booking.locale === "en";
  const detail = `<strong>${escapeHtml(booking.reference)}</strong><br>${escapeHtml(booking.itemName)} · ${escapeHtml(booking.checkIn)} → ${escapeHtml(booking.checkOut)}<br>${escapeHtml(formatXaf(booking.total, booking.locale))} · ${escapeHtml(booking.paymentMethod === "cash" ? (en ? "Pay at hotel" : "Paiement sur place") : booking.paymentMethod === "card" ? (en ? "Card payment" : "Paiement par carte") : "PayPal")}`;
  await Promise.all([
    sendHotelMail(booking.guestEmail, en ? `Your request ${booking.reference} · Palacio Hotel` : `Votre demande ${booking.reference} · Palacio Hotel`, template(settings, en ? "BOOKING REQUEST" : "DEMANDE DE RÉSERVATION", en ? "Your Palacio stay begins here" : "Votre séjour Palacio commence ici", en ? `Dear ${booking.guestName},` : `Cher/chère ${booking.guestName},`, en ? "Thank you for choosing Palacio Hotel. Your request has been received and our team will confirm availability shortly." : "Merci d’avoir choisi le Palacio Hotel. Votre demande a bien été reçue ; notre équipe vous confirmera la disponibilité dans les meilleurs délais.", detail, en ? "We look forward to welcoming you. This request is subject to confirmation by our team." : "Au plaisir de vous accueillir. Cette demande reste soumise à la confirmation de notre équipe."), settings),
    sendHotelMail(settings.email, `Nouvelle réservation ${booking.reference} · ${booking.guestName}`, template(settings, "NOUVELLE RÉSERVATION", "Une nouvelle demande vous attend", `Bonjour l’équipe Palacio,`, `${booking.guestName} vient de demander une réservation. Consultez le backoffice pour la traiter.`, `${detail}<br>${escapeHtml(booking.guestEmail)} · ${escapeHtml(booking.guestPhone)}${booking.notes ? `<br>${escapeHtml(booking.notes)}` : ""}`, "Rendez-vous dans le backoffice pour confirmer ou modifier cette demande."), settings),
  ]);
}

export async function sendQuoteReceivedEmails(quote: QuoteRequest, settings: HotelSettings, pdf: Uint8Array) {
  const en = quote.locale === "en";
  const detail = `<strong>${escapeHtml(quote.reference)}</strong><br>${escapeHtml(quote.requestKind)} · ${escapeHtml(quote.people)} ${en ? "guests" : "personnes"}${quote.checkIn ? `<br>${escapeHtml(quote.checkIn)} → ${escapeHtml(quote.checkOut)}` : ""}`;
  await Promise.all([
    sendHotelMail(quote.guestEmail, en ? `We received your request ${quote.reference}` : `Nous avons reçu votre demande ${quote.reference}`, template(settings, en ? "REQUEST RECEIVED" : "DEMANDE REÇUE", en ? "Something special is on its way" : "Une belle expérience se prépare", en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, en ? "Thank you for contacting Palacio Hotel. Our team is reviewing your request and will prepare a personalized proposal for you. Your acknowledgment is attached." : "Merci de votre confiance. Notre équipe étudie votre demande et préparera une proposition personnalisée. Votre accusé de réception est joint à cet e-mail.", detail, en ? "Our team remains at your disposal for any questions." : "Notre équipe reste à votre écoute pour toute question."), settings, [{ filename: `${quote.reference}-accuse.pdf`, content: Buffer.from(pdf) }]),
    sendHotelMail(settings.email, `Nouveau devis ${quote.reference} · ${quote.guestName}`, template(settings, "NOUVEAU DEVIS", "Une nouvelle demande de devis", "Bonjour l’équipe Palacio,", `${quote.guestName} attend une proposition. Consultez le backoffice pour renseigner le montant TTC et la date de validité.`, `${detail}<br>${escapeHtml(quote.guestEmail)} · ${escapeHtml(quote.guestPhone)}${quote.message ? `<br>${escapeHtml(quote.message)}` : ""}`, "Traitez cette demande dans votre espace d’administration."), settings),
  ]);
}

export async function sendQuoteSentEmail(quote: QuoteRequest, settings: HotelSettings, pdf: Uint8Array, publicUrl: string) {
  const en = quote.locale === "en";
  return sendHotelMail(quote.guestEmail, en ? `Your personalized quote ${quote.reference} · Palacio Hotel` : `Votre devis personnalisé ${quote.reference} · Palacio Hotel`, template(settings, en ? "YOUR QUOTE IS READY" : "VOTRE DEVIS EST PRÊT", en ? "An experience made just for you" : "Une expérience imaginée pour vous", en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, en ? "We are delighted to share our personalized proposal. You can find the full quote attached and download it from your private link." : "Nous avons le plaisir de vous transmettre notre proposition personnalisée. Retrouvez le devis en pièce jointe et téléchargez-le depuis votre lien privé.", `<strong>${escapeHtml(quote.reference)}</strong><br>${escapeHtml(formatXaf(quote.amountTtc || 0, quote.locale))}<br>${en ? "Valid until" : "Valable jusqu’au"} ${escapeHtml(quote.validUntil)}<br><a style="color:#946f42" href="${escapeHtml(publicUrl)}">${en ? "View my quote" : "Consulter mon devis"}</a>`, en ? "We would be delighted to organize your visit. Reply to this email with any questions." : "Nous serions ravis d’organiser votre venue. Répondez à cet e-mail pour toute question."), settings, [{ filename: `${quote.reference}-devis.pdf`, content: Buffer.from(pdf) }]);
}

export async function sendStatusEmail(to: string, name: string, reference: string, status: string, kind: "booking" | "quote", locale: string, settings: HotelSettings) {
  const en = locale === "en";
  const label: Record<string, [string, string]> = { confirmed: ["confirmée", "confirmed"], cancelled: ["annulée", "cancelled"], rejected: ["refusée", "declined"], accepted: ["accepté", "accepted"], negotiating: ["en discussion", "under discussion"], expired: ["expiré", "expired"] };
  const state = label[status]?.[en ? 1 : 0] || status;
  await sendHotelMail(to, `${reference} · ${en ? "Update" : "Mise à jour"} · Palacio Hotel`, template(settings, en ? "UPDATE" : "MISE À JOUR", en ? "News about your request" : "Des nouvelles de votre demande", en ? `Dear ${name},` : `Cher/chère ${name},`, en ? `The status of your ${kind === "booking" ? "booking" : "quote"} has been updated.` : `Le statut de votre ${kind === "booking" ? "réservation" : "devis"} a été mis à jour.`, `<strong>${escapeHtml(reference)}</strong><br>${en ? "Status" : "Statut"} : ${escapeHtml(state)}`, en ? "Our team is here if you have any questions." : "Notre équipe reste à votre disposition pour toute question."), settings);
}
