import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type { Booking, HotelSettings, QuoteRequest } from "@/db/schema";
import { formatXaf } from "@/lib/hotel";

const escapeHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);

function template(settings: HotelSettings, eyebrow: string, title: string, greeting: string, body: string, detail: string, footer: string) {
  const palette = settings.theme === "midnight"
    ? { deep: "#1b303c", accent: "#bf9a68", page: "#f0f3f3", soft: "#f7f8f8", text: "#203744", muted: "#5d6879", footer: "#e5e8ee" }
    : settings.theme === "terracotta"
      ? { deep: "#6d3f31", accent: "#c88860", page: "#f7f0e9", soft: "#fbf8f5", text: "#533d32", muted: "#76615a", footer: "#f0e3dc" }
      : { deep: "#18382e", accent: "#c09a63", page: "#faf9f5", soft: "#f3f2ed", text: "#20392f", muted: "#6e786f", footer: "#f0eee8" };
  return `<!doctype html><html><body style="margin:0;background:${palette.page};font-family:Arial,Helvetica,sans-serif;color:${palette.text}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:4px;overflow:hidden"><tr><td style="background:${palette.deep};padding:32px 44px;color:#fff"><div style="font-family:Georgia,serif;font-size:28px;letter-spacing:3px">PALACIO</div><div style="font-size:10px;letter-spacing:5px;color:${palette.accent};margin-top:3px">H O T E L</div></td></tr><tr><td style="padding:42px 44px"><div style="color:${palette.accent};font-size:11px;letter-spacing:2px;font-weight:bold;text-transform:uppercase">${escapeHtml(eyebrow)}</div><h1 style="font-family:Georgia,serif;font-weight:normal;font-size:30px;line-height:1.2;margin:14px 0 22px;color:${palette.text}">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.8;margin:0 0 16px">${escapeHtml(greeting)}</p><p style="font-size:15px;line-height:1.8;color:${palette.muted};margin:0 0 22px">${escapeHtml(body)}</p><div style="background:${palette.soft};border-left:3px solid ${palette.accent};padding:18px 22px;font-size:14px;line-height:1.9;color:${palette.text}">${detail}</div><p style="font-size:14px;line-height:1.8;color:${palette.muted};margin-top:24px">${escapeHtml(footer)}</p></td></tr><tr><td style="background:${palette.footer};padding:23px 44px;color:${palette.muted};font-size:12px;line-height:1.7">${escapeHtml(settings.hotelName)} · ${escapeHtml(settings.addressFr)}<br>${escapeHtml(settings.phone)} · ${escapeHtml(settings.email)}</td></tr></table></td></tr></table></body></html>`;
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
  const attachment = { filename: `${quote.reference}-devis.pdf`, content: Buffer.from(pdf) };
  const [sent] = await Promise.all([
    sendHotelMail(quote.guestEmail, en ? `Your personalized quote ${quote.reference} · Palacio Hotel` : `Votre devis personnalisé ${quote.reference} · Palacio Hotel`, template(settings, en ? "YOUR QUOTE IS READY" : "VOTRE DEVIS EST PRÊT", en ? "An experience made just for you" : "Une expérience imaginée pour vous", en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, en ? "We are delighted to share our personalized proposal. You can find the full quote attached and download it from your private link." : "Nous avons le plaisir de vous transmettre notre proposition personnalisée. Retrouvez le devis en pièce jointe et téléchargez-le depuis votre lien privé.", `<strong>${escapeHtml(quote.reference)}</strong><br>${escapeHtml(formatXaf(quote.amountTtc || 0, quote.locale))}<br>${en ? "Valid until" : "Valable jusqu’au"} ${escapeHtml(quote.validUntil)}<br><a style="color:#946f42" href="${escapeHtml(publicUrl)}">${en ? "View my quote" : "Consulter mon devis"}</a>`, en ? "We would be delighted to organize your visit. Reply to this email with any questions." : "Nous serions ravis d’organiser votre venue. Répondez à cet e-mail pour toute question."), settings, [attachment]),
    sendHotelMail(settings.email, `Devis envoyé ${quote.reference} · ${quote.guestName}`, template(settings, "DEVIS ENVOYÉ", "La proposition a été transmise au client", "Bonjour l’équipe Palacio,", `${quote.guestName} a reçu son devis personnalisé.`, `<strong>${escapeHtml(quote.reference)}</strong><br>${escapeHtml(formatXaf(quote.amountTtc || 0, quote.locale))}<br>${escapeHtml(quote.guestEmail)}`, "Le PDF est joint. Retrouvez le devis dans le backoffice."), settings, [attachment]),
  ]);
  return sent;
}

export async function sendQuoteCancellationEmails(quote: QuoteRequest, settings: HotelSettings) {
  const en = quote.locale === "en";
  const detail = `<strong>${escapeHtml(quote.reference)}</strong><br>${escapeHtml(quote.requestKind)}${quote.amountTtc ? `<br>${escapeHtml(formatXaf(quote.amountTtc, quote.locale))}` : ""}`;
  await Promise.all([
    sendHotelMail(quote.guestEmail, en ? `Cancellation confirmed ${quote.reference} · Palacio Hotel` : `Annulation confirmée ${quote.reference} · Palacio Hotel`, template(settings, en ? "REQUEST CANCELLED" : "DEMANDE ANNULÉE", en ? "Your quote request has been cancelled" : "Votre demande de devis est annulée", en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, en ? "We confirm the cancellation of your quote request. It will not be pursued." : "Nous confirmons l’annulation de votre demande de devis. Elle ne sera pas poursuivie.", detail, en ? "You can send a new request whenever you wish. Our team remains at your disposal." : "Vous pouvez déposer une nouvelle demande quand vous le souhaitez. Notre équipe reste à votre disposition."), settings),
    sendHotelMail(settings.email, `Annulation client ${quote.reference} · ${quote.guestName}`, template(settings, "DEMANDE ANNULÉE", "Une demande de devis vient d’être annulée", "Bonjour l’équipe Palacio,", `${quote.guestName} a annulé sa demande de devis depuis son espace.`, `${detail}<br>${escapeHtml(quote.guestEmail)} · ${escapeHtml(quote.guestPhone)}`, "Retrouvez cette demande dans le backoffice."), settings),
  ]);
}

export async function sendBookingCancellationEmails(booking: Booking, settings: HotelSettings) {
  const en = booking.locale === "en";
  const detail = `<strong>${escapeHtml(booking.reference)}</strong><br>${escapeHtml(booking.itemName)}<br>${escapeHtml(booking.checkIn)} → ${escapeHtml(booking.checkOut)}<br>${escapeHtml(formatXaf(booking.total, booking.locale))}`;
  await Promise.all([
    sendHotelMail(booking.guestEmail, en ? `Cancellation confirmed ${booking.reference} · Palacio Hotel` : `Annulation confirmée ${booking.reference} · Palacio Hotel`, template(settings, en ? "CANCELLATION CONFIRMED" : "ANNULATION CONFIRMÉE", en ? "Your booking has been cancelled" : "Votre réservation est annulée", en ? `Dear ${booking.guestName},` : `Cher/chère ${booking.guestName},`, en ? "We confirm the cancellation of your booking. The dates are released and this stay will not take place." : "Nous confirmons l’annulation de votre réservation. Les dates sont libérées et ce séjour n’aura pas lieu.", detail, en ? "If a payment was already received, our team will contact you about the refund. We hope to welcome you another time." : "Si un paiement a déjà été reçu, notre équipe vous contactera pour le remboursement. Nous espérons vous accueillir une autre fois."), settings),
    sendHotelMail(settings.email, `Annulation client ${booking.reference} · ${booking.guestName}`, template(settings, "ANNULATION CLIENT", "Une réservation vient d’être annulée", "Bonjour l’équipe Palacio,", `${booking.guestName} a annulé sa réservation depuis son espace. Les dates sont de nouveau disponibles.`, `${detail}<br>${escapeHtml(booking.guestEmail)} · ${escapeHtml(booking.guestPhone)}`, "Consultez le backoffice pour vérifier le paiement et, si besoin, organiser le remboursement."), settings),
  ]);
}

const bookingStateCopy = (booking: Booking, status: string) => {
  const en = booking.locale === "en";
  const detail = `<strong>${escapeHtml(booking.reference)}</strong><br>${escapeHtml(booking.itemName)}<br>${escapeHtml(booking.checkIn)} → ${escapeHtml(booking.checkOut)}<br>${escapeHtml(formatXaf(booking.total, booking.locale))}`;
  const states: Record<string, { eyebrow: [string, string]; title: [string, string]; body: [string, string]; admin: string }> = {
    confirmed: { eyebrow: ["RÉSERVATION CONFIRMÉE", "BOOKING CONFIRMED"], title: ["Votre séjour est confirmé", "Your stay is confirmed"], body: ["Notre équipe confirme votre réservation. Nous vous attendons aux dates indiquées.", "Our team confirms your booking. We look forward to welcoming you on the dates below."], admin: `${booking.guestName} a une réservation confirmée.` },
    cancelled: { eyebrow: ["RÉSERVATION ANNULÉE", "BOOKING CANCELLED"], title: ["Votre réservation est annulée", "Your booking has been cancelled"], body: ["Votre réservation a été annulée. Les dates sont libérées.", "Your booking has been cancelled and the dates have been released."], admin: `La réservation de ${booking.guestName} est annulée. Les dates sont de nouveau disponibles.` },
    checked_in: { eyebrow: ["SÉJOUR EN COURS", "STAY IN PROGRESS"], title: ["Bienvenue au Palacio", "Welcome to Palacio"], body: ["Votre arrivée est enregistrée. Nous vous souhaitons un excellent séjour.", "Your arrival has been recorded. We wish you a wonderful stay."], admin: `${booking.guestName} est arrivé.` },
    checked_out: { eyebrow: ["SÉJOUR TERMINÉ", "STAY COMPLETED"], title: ["Merci de votre visite", "Thank you for staying with us"], body: ["Votre séjour est terminé. Nous espérons vous revoir bientôt.", "Your stay is complete. We hope to welcome you again soon."], admin: `Le séjour de ${booking.guestName} est terminé.` },
    paid: { eyebrow: ["PAIEMENT REÇU", "PAYMENT RECEIVED"], title: ["Merci pour votre paiement", "Thank you for your payment"], body: ["Votre paiement a bien été reçu. Notre équipe confirme le suivi de votre réservation.", "Your payment has been received. Our team is following up on your booking."], admin: `${booking.guestName} a réglé ${formatXaf(booking.total, "fr")}.` },
  };
  const state = states[status] || { eyebrow: ["MISE À JOUR", "UPDATE"], title: ["Des nouvelles de votre réservation", "News about your booking"], body: ["Le statut de votre réservation a été mis à jour.", "The status of your booking has been updated."], admin: `La réservation de ${booking.guestName} a changé d’état (${status}).` };
  return { en, detail, state };
};

export async function sendBookingStateEmails(booking: Booking, settings: HotelSettings, status: string) {
  const { en, detail, state } = bookingStateCopy(booking, status);
  const index = en ? 1 : 0;
  await Promise.all([
    sendHotelMail(booking.guestEmail, `${booking.reference} · ${state.title[index]} · Palacio Hotel`, template(settings, state.eyebrow[index], state.title[index], en ? `Dear ${booking.guestName},` : `Cher/chère ${booking.guestName},`, state.body[index], detail, en ? "Our team remains at your disposal." : "Notre équipe reste à votre disposition."), settings),
    sendHotelMail(settings.email, `${booking.reference} · ${state.eyebrow[0]} · ${booking.guestName}`, template(settings, state.eyebrow[0], state.title[0], "Bonjour l’équipe Palacio,", state.admin, `${detail}<br>${escapeHtml(booking.guestEmail)} · ${escapeHtml(booking.guestPhone)}`, "Retrouvez cette réservation dans le backoffice."), settings),
  ]);
}

const quoteStateCopy = (quote: QuoteRequest, status: string) => {
  const en = quote.locale === "en";
  const detail = `<strong>${escapeHtml(quote.reference)}</strong><br>${escapeHtml(quote.requestKind)}${quote.amountTtc ? `<br>${escapeHtml(formatXaf(quote.amountTtc, quote.locale))}` : ""}`;
  const states: Record<string, { eyebrow: [string, string]; title: [string, string]; body: [string, string]; admin: string }> = {
    in_review: { eyebrow: ["DEVIS EN ÉTUDE", "QUOTE UNDER REVIEW"], title: ["Votre demande est à l’étude", "Your request is under review"], body: ["Notre équipe prépare une proposition adaptée à votre projet.", "Our team is preparing a proposal tailored to your plans."], admin: `${quote.guestName} attend l’étude de son devis.` },
    quote_sent: { eyebrow: ["DEVIS ENVOYÉ", "QUOTE SENT"], title: ["Le devis a été transmis", "The quote has been sent"], body: ["Votre proposition personnalisée est disponible.", "Your personalized proposal is available."], admin: `Le devis de ${quote.guestName} a été envoyé.` },
    negotiating: { eyebrow: ["DEVIS EN DISCUSSION", "QUOTE UNDER DISCUSSION"], title: ["Votre devis est en discussion", "Your quote is under discussion"], body: ["Nous restons à votre écoute pour ajuster la proposition.", "We remain available to adjust the proposal."], admin: `Le devis de ${quote.guestName} est en discussion.` },
    accepted: { eyebrow: ["DEVIS ACCEPTÉ", "QUOTE ACCEPTED"], title: ["Votre acceptation est enregistrée", "Your acceptance is confirmed"], body: ["Merci. Votre acceptation est enregistrée. Le devis signé est joint à cet e-mail lorsqu’il est disponible.", "Thank you. Your acceptance is recorded. The signed quote is attached when available."], admin: `${quote.guestName} a accepté le devis${quote.amountTtc ? ` de ${formatXaf(quote.amountTtc, "fr")}` : ""}.` },
    rejected: { eyebrow: ["DEVIS REFUSÉ", "QUOTE DECLINED"], title: ["Votre devis a été refusé", "Your quote has been declined"], body: ["Cette proposition n’est plus d’actualité. Notre équipe reste disponible pour un nouveau projet.", "This proposal is no longer active. Our team remains available for a new project."], admin: `Le devis de ${quote.guestName} a été refusé.` },
    expired: { eyebrow: ["DEVIS EXPIRÉ", "QUOTE EXPIRED"], title: ["Votre devis a expiré", "Your quote has expired"], body: ["La date de validité est dépassée. Contactez-nous si vous souhaitez une nouvelle proposition.", "The validity date has passed. Contact us if you would like a new proposal."], admin: `Le devis de ${quote.guestName} a expiré.` },
  };
  const state = states[status] || { eyebrow: ["MISE À JOUR", "UPDATE"], title: ["Des nouvelles de votre devis", "News about your quote"], body: ["Le statut de votre devis a été mis à jour.", "The status of your quote has been updated."], admin: `Le devis de ${quote.guestName} a changé d’état (${status}).` };
  return { en, detail, state };
};

export async function sendQuoteStateEmails(quote: QuoteRequest, settings: HotelSettings, status: string, attachments?: Mail.Attachment[]) {
  const { en, detail, state } = quoteStateCopy(quote, status);
  const index = en ? 1 : 0;
  await Promise.all([
    sendHotelMail(quote.guestEmail, `${quote.reference} · ${state.title[index]} · Palacio Hotel`, template(settings, state.eyebrow[index], state.title[index], en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, state.body[index], detail, en ? "Our team remains at your disposal." : "Notre équipe reste à votre disposition."), settings, attachments),
    sendHotelMail(settings.email, `${quote.reference} · ${state.eyebrow[0]} · ${quote.guestName}`, template(settings, state.eyebrow[0], state.title[0], "Bonjour l’équipe Palacio,", state.admin, `${detail}<br>${escapeHtml(quote.guestEmail)} · ${escapeHtml(quote.guestPhone)}`, "Retrouvez ce devis dans le backoffice."), settings, attachments),
  ]);
}

export async function sendStatusEmail(to: string, name: string, reference: string, status: string, kind: "booking" | "quote", locale: string, settings: HotelSettings) {
  const en = locale === "en";
  const label: Record<string, [string, string]> = { confirmed: ["confirmée", "confirmed"], cancelled: ["annulée", "cancelled"], rejected: ["refusée", "declined"], accepted: ["accepté", "accepted"], negotiating: ["en discussion", "under discussion"], expired: ["expiré", "expired"] };
  const state = label[status]?.[en ? 1 : 0] || status;
  await sendHotelMail(to, `${reference} · ${en ? "Update" : "Mise à jour"} · Palacio Hotel`, template(settings, en ? "UPDATE" : "MISE À JOUR", en ? "News about your request" : "Des nouvelles de votre demande", en ? `Dear ${name},` : `Cher/chère ${name},`, en ? `The status of your ${kind === "booking" ? "booking" : "quote"} has been updated.` : `Le statut de votre ${kind === "booking" ? "réservation" : "devis"} a été mis à jour.`, `<strong>${escapeHtml(reference)}</strong><br>${en ? "Status" : "Statut"} : ${escapeHtml(state)}`, en ? "Our team is here if you have any questions." : "Notre équipe reste à votre disposition pour toute question."), settings);
}
