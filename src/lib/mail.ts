import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type { Booking, HotelSettings, QuoteRequest } from "@/db/schema";
import { formatXaf } from "@/lib/format";
import { emailLogoDelivery, emailPalette, themedEmailHtml } from "@/lib/email-theme";
import { smtpEnvFromSettings, smtpFromAddress, smtpTransportOptions } from "@/lib/smtp";
import { requestKindLabel } from "@/lib/request-kind";

const escapeHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);

function template(settings: HotelSettings & { mailOrigin?: string }, eyebrow: string, title: string, greeting: string, body: string, detail: string, footer: string) {
  return themedEmailHtml(settings.theme, { eyebrow, title, greeting, body, detail, footer, hotelName: settings.hotelName, address: settings.addressFr, phone: settings.phone, email: settings.email }, settings.themeColors, emailLogoDelivery(settings.logoUrl, settings.mailOrigin));
}

export function mailDate(value: string | null | undefined, locale: string) {
  const iso = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export { requestKindLabel } from "@/lib/request-kind";

function paymentMethodLabel(method: string, en: boolean) {
  if (method === "cash") return en ? "Pay at the hotel" : "Paiement sur place";
  if (method === "card") return en ? "Card payment" : "Paiement par carte";
  if (method === "paypal") return "PayPal";
  return method.replaceAll("_", " ");
}

function paymentStatusLabel(status: string, en: boolean) {
  const labels: Record<string, [string, string]> = {
    unpaid: ["Non payé", "Unpaid"],
    awaiting_payment: ["Paiement en attente", "Payment pending"],
    pay_on_site: ["À régler à l’hôtel", "To be paid at the hotel"],
    paid: ["Payé", "Paid"],
    refunded: ["Remboursé", "Refunded"],
  };
  return labels[status]?.[en ? 1 : 0] || status.replaceAll("_", " ");
}

export type CancellationOutcome = "refunded" | "failed" | "manual";

export function cancellationNotice(booking: Pick<Booking, "paymentStatus" | "locale">, outcome?: CancellationOutcome) {
  const en = booking.locale === "en";
  if (outcome === "refunded") return en ? "Your refund has been sent to the same payment method. It can take a few days to appear." : "Votre remboursement a été envoyé sur le même moyen de paiement. Il peut prendre quelques jours avant d’apparaître.";
  if (outcome === "failed" || outcome === "manual" || booking.paymentStatus === "paid") return en ? "A payment has already been received. Our team will contact you about the refund." : "Un paiement a déjà été reçu. Notre équipe vous contactera pour le remboursement.";
  if (booking.paymentStatus === "refunded") return en ? "The payment for this stay has already been refunded." : "Le paiement de ce séjour a déjà été remboursé.";
  if (booking.paymentStatus === "awaiting_payment") return en ? "No payment has been collected for this stay." : "Aucun paiement n’a été encaissé pour ce séjour.";
  return en ? "No payment is due for this cancelled stay." : "Aucun paiement n’est dû pour ce séjour annulé.";
}

export function adminCancellationPaymentNote(booking: { paymentStatus: string; refundError?: string | null }, outcome?: CancellationOutcome) {
  if (outcome === "refunded") return "Le remboursement a été envoyé au client.";
  if (outcome === "failed") return `Le remboursement automatique a échoué${booking.refundError ? ` : ${booking.refundError}` : ""}. Relancez-le depuis la réservation.`;
  if (outcome === "manual") return "Un paiement a été encaissé : confirmez le remboursement si le séjour doit être recrédité.";
  if (booking.paymentStatus === "paid") return "Un paiement a été encaissé : organisez le remboursement.";
  if (booking.paymentStatus === "refunded") return "Le paiement est déjà remboursé.";
  return "Aucun paiement n’a été encaissé.";
}

export function guestCancellationCopy(booking: Pick<Booking, "paymentStatus" | "locale">, actor: "guest" | "hotel", outcome?: CancellationOutcome) {
  const en = booking.locale === "en";
  const closing = en ? "We hope to welcome you another time." : "Nous espérons vous accueillir une autre fois.";
  const body = actor === "guest"
    ? (en ? "We confirm the cancellation of your booking. The dates are released and this stay will not take place." : "Nous confirmons l’annulation de votre réservation. Les dates sont libérées et ce séjour n’aura pas lieu.")
    : (en ? "The hotel has cancelled your booking. The dates have been released and this stay will not take place." : "L’hôtel a annulé votre réservation. Les dates sont libérées et ce séjour n’aura pas lieu.");
  return { body, footer: `${cancellationNotice(booking, outcome)} ${closing}` };
}

export function bookingMailDetail(booking: Pick<Booking, "reference" | "itemName" | "checkIn" | "checkOut" | "guests" | "quantity" | "total" | "locale" | "paymentMethod" | "paymentStatus">) {
  const en = booking.locale === "en";
  const dates = [mailDate(booking.checkIn, booking.locale), mailDate(booking.checkOut, booking.locale)].filter(Boolean).join(" → ");
  const people = en ? `${booking.guests} guest${booking.guests > 1 ? "s" : ""}` : `${booking.guests} personne${booking.guests > 1 ? "s" : ""}`;
  const units = booking.quantity > 1 ? (en ? ` · ${booking.quantity} units` : ` · ${booking.quantity} unités`) : "";
  const payment = `${formatXaf(booking.total, booking.locale)} · ${paymentMethodLabel(booking.paymentMethod, en)} · ${paymentStatusLabel(booking.paymentStatus, en)}`;
  return `<strong>${escapeHtml(booking.reference)}</strong><br>${escapeHtml(booking.itemName)}<br>${escapeHtml(dates)}<br>${escapeHtml(`${people}${units}`)}<br>${escapeHtml(payment)}`;
}

export function quoteMailDetail(quote: Pick<QuoteRequest, "reference" | "requestKind" | "people" | "checkIn" | "checkOut" | "amountTtc" | "locale" | "validUntil"> & { selectedItems?: QuoteRequest["selectedItems"] }, options?: { validity?: boolean }) {
  const en = quote.locale === "en";
  const people = quote.people == null ? "" : en ? `${quote.people} guest${quote.people > 1 ? "s" : ""}` : `${quote.people} personne${quote.people > 1 ? "s" : ""}`;
  const dates = [mailDate(quote.checkIn, quote.locale), mailDate(quote.checkOut, quote.locale)].filter(Boolean).join(" → ");
  const items = (quote.selectedItems || []).map((item) => `${en ? item.name_en : item.name_fr}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`).filter(Boolean).join(" · ");
  const lines = [`<strong>${escapeHtml(quote.reference)}</strong>`, escapeHtml(requestKindLabel(quote.requestKind, quote.locale)), items ? escapeHtml(items) : "", escapeHtml(people), dates ? escapeHtml(dates) : "", quote.amountTtc != null ? escapeHtml(formatXaf(quote.amountTtc, quote.locale)) : ""];
  if (options?.validity && quote.validUntil) lines.push(escapeHtml(`${en ? "Valid until" : "Valable jusqu’au"} ${mailDate(quote.validUntil, quote.locale)}`));
  return lines.filter(Boolean).join("<br>");
}

export async function sendHotelMail(to: string, subject: string, html: string, settings: HotelSettings, attachments?: Mail.Attachment[]) {
  const smtpEnv = smtpEnvFromSettings(settings);
  const transport = smtpTransportOptions(smtpEnv);
  if (!transport) { console.info(`[Palacio] SMTP not configured; email queued in-app: ${subject}`); return false; }
  try {
    const transporter = nodemailer.createTransport(transport);
    await transporter.sendMail({ from: smtpFromAddress(settings.hotelName, settings.email, smtpEnv), to, subject, html, attachments });
    return true;
  } catch (error) { console.error("[Palacio] SMTP delivery failed:", error); return false; }
}

export async function sendBookingEmails(booking: Booking, settings: HotelSettings, origin = "", pdf?: Uint8Array) {
  const en = booking.locale === "en";
  const detail = bookingMailDetail(booking);
  const attachment = pdf ? [{ filename: `${booking.reference || "reservation"}-recu.pdf`, content: Buffer.from(pdf) }] : undefined;
  await Promise.all([
    sendHotelMail(booking.guestEmail, en ? `Your request ${booking.reference} · ${settings.hotelName}` : `Votre demande ${booking.reference} · ${settings.hotelName}`, template({ ...settings, mailOrigin: origin }, en ? "BOOKING REQUEST" : "DEMANDE DE RÉSERVATION", en ? "Your stay begins here" : "Votre séjour commence ici", en ? `Dear ${booking.guestName},` : `Cher/chère ${booking.guestName},`, en ? `Thank you for choosing ${settings.hotelName}. Your request has been received and our team will confirm availability shortly.` : `Merci d’avoir choisi ${settings.hotelName}. Votre demande a bien été reçue ; notre équipe vous confirmera la disponibilité dans les meilleurs délais.`, detail, en ? "We look forward to welcoming you. This request is subject to confirmation by our team." : "Au plaisir de vous accueillir. Cette demande reste soumise à la confirmation de notre équipe."), settings, attachment),
    sendHotelMail(settings.email, `Nouvelle réservation ${booking.reference} · ${booking.guestName}`, template({ ...settings, mailOrigin: origin }, "NOUVELLE RÉSERVATION", "Une nouvelle demande vous attend", `Bonjour l’équipe ${settings.hotelName},`, `${booking.guestName} vient de demander une réservation. Consultez le backoffice pour la traiter.`, `${detail}<br>${escapeHtml(booking.guestEmail)} · ${escapeHtml(booking.guestPhone)}${booking.notes ? `<br>${escapeHtml(booking.notes)}` : ""}`, "Rendez-vous dans le backoffice pour confirmer ou modifier cette demande."), settings, attachment),
  ]);
}

export async function sendQuoteReceivedEmails(quote: QuoteRequest, settings: HotelSettings, pdf: Uint8Array, origin = "") {
  const en = quote.locale === "en";
  const detail = quoteMailDetail(quote);
  await Promise.all([
    sendHotelMail(quote.guestEmail, en ? `We received your request ${quote.reference}` : `Nous avons reçu votre demande ${quote.reference}`, template({ ...settings, mailOrigin: origin }, en ? "REQUEST RECEIVED" : "DEMANDE REÇUE", en ? "Something special is on its way" : "Une belle expérience se prépare", en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, en ? `Thank you for contacting ${settings.hotelName}. Our team is reviewing your request and will prepare a personalized proposal for you. Your acknowledgment is attached.` : "Merci de votre confiance. Notre équipe étudie votre demande et préparera une proposition personnalisée. Votre accusé de réception est joint à cet e-mail.", detail, en ? "Our team remains at your disposal for any questions." : "Notre équipe reste à votre écoute pour toute question."), settings, [{ filename: `${quote.reference}-accuse.pdf`, content: Buffer.from(pdf) }]),
    sendHotelMail(settings.email, `Nouveau devis ${quote.reference} · ${quote.guestName}`, template({ ...settings, mailOrigin: origin }, "NOUVEAU DEVIS", "Une nouvelle demande de devis", `Bonjour l’équipe ${settings.hotelName},`, `${quote.guestName} attend une proposition. Consultez le backoffice pour renseigner le montant TTC et la date de validité.`, `${detail}<br>${escapeHtml(quote.guestEmail)} · ${escapeHtml(quote.guestPhone)}${quote.message ? `<br>${escapeHtml(quote.message)}` : ""}`, "Traitez cette demande dans votre espace d’administration."), settings),
  ]);
}

export async function sendQuoteSentEmail(quote: QuoteRequest, settings: HotelSettings, pdf: Uint8Array, publicUrl: string) {
  const en = quote.locale === "en";
  const origin = (() => { try { return new URL(publicUrl).origin; } catch { return ""; } })();
  const attachment = { filename: `${quote.reference}-devis.pdf`, content: Buffer.from(pdf) };
  const [sent] = await Promise.all([
    sendHotelMail(quote.guestEmail, en ? `Your personalized quote ${quote.reference} · ${settings.hotelName}` : `Votre devis personnalisé ${quote.reference} · ${settings.hotelName}`, template({ ...settings, mailOrigin: origin }, en ? "YOUR QUOTE IS READY" : "VOTRE DEVIS EST PRÊT", en ? "An experience made just for you" : "Une expérience imaginée pour vous", en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, en ? "We are delighted to share our personalized proposal. You can find the full quote attached and download it from your private link." : "Nous avons le plaisir de vous transmettre notre proposition personnalisée. Retrouvez le devis en pièce jointe et téléchargez-le depuis votre lien privé.", `${quoteMailDetail(quote, { validity: true })}<br><a style="color:${emailPalette(settings.theme, settings.themeColors).accent}" href="${escapeHtml(publicUrl)}">${en ? "View my quote" : "Consulter mon devis"}</a>`, en ? "We would be delighted to organize your visit. Reply to this email with any questions." : "Nous serions ravis d’organiser votre venue. Répondez à cet e-mail pour toute question."), settings, [attachment]),
    sendHotelMail(settings.email, `Devis envoyé ${quote.reference} · ${quote.guestName}`, template({ ...settings, mailOrigin: origin }, "DEVIS ENVOYÉ", "La proposition a été transmise au client", `Bonjour l’équipe ${settings.hotelName},`, `${quote.guestName} a reçu son devis personnalisé.`, `${quoteMailDetail(quote)}<br>${escapeHtml(quote.guestEmail)}`, "Le PDF est joint. Retrouvez le devis dans le backoffice."), settings, [attachment]),
  ]);
  return sent;
}

export async function sendQuoteCancellationEmails(quote: QuoteRequest, settings: HotelSettings, origin = "") {
  const en = quote.locale === "en";
  const detail = quoteMailDetail(quote);
  await Promise.all([
    sendHotelMail(quote.guestEmail, en ? `Cancellation confirmed ${quote.reference} · ${settings.hotelName}` : `Annulation confirmée ${quote.reference} · ${settings.hotelName}`, template({ ...settings, mailOrigin: origin }, en ? "REQUEST CANCELLED" : "DEMANDE ANNULÉE", en ? "Your quote request has been cancelled" : "Votre demande de devis est annulée", en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, en ? "We confirm the cancellation of your quote request. It will not be pursued." : "Nous confirmons l’annulation de votre demande de devis. Elle ne sera pas poursuivie.", detail, en ? "You can send a new request whenever you wish. Our team remains at your disposal." : "Vous pouvez déposer une nouvelle demande quand vous le souhaitez. Notre équipe reste à votre disposition."), settings),
    sendHotelMail(settings.email, `Annulation client ${quote.reference} · ${quote.guestName}`, template({ ...settings, mailOrigin: origin }, "DEMANDE ANNULÉE", "Une demande de devis vient d’être annulée", `Bonjour l’équipe ${settings.hotelName},`, `${quote.guestName} a annulé sa demande de devis depuis son espace.`, `${detail}<br>${escapeHtml(quote.guestEmail)} · ${escapeHtml(quote.guestPhone)}`, "Retrouvez cette demande dans le backoffice."), settings),
  ]);
}

export async function sendBookingCancellationEmails(booking: Booking, settings: HotelSettings, origin = "", outcome?: CancellationOutcome) {
  const en = booking.locale === "en";
  const detail = bookingMailDetail(booking);
  const copy = guestCancellationCopy(booking, "guest", outcome);
  const adminPayment = adminCancellationPaymentNote(booking, outcome);
  await Promise.all([
    sendHotelMail(booking.guestEmail, en ? `Cancellation confirmed ${booking.reference} · ${settings.hotelName}` : `Annulation confirmée ${booking.reference} · ${settings.hotelName}`, template({ ...settings, mailOrigin: origin }, en ? "CANCELLATION CONFIRMED" : "ANNULATION CONFIRMÉE", en ? "Your booking has been cancelled" : "Votre réservation est annulée", en ? `Dear ${booking.guestName},` : `Cher/chère ${booking.guestName},`, copy.body, detail, copy.footer), settings),
    sendHotelMail(settings.email, `Annulation client ${booking.reference} · ${booking.guestName}`, template({ ...settings, mailOrigin: origin }, "ANNULATION CLIENT", "Une réservation vient d’être annulée", `Bonjour l’équipe ${settings.hotelName},`, `${booking.guestName} a annulé sa réservation depuis son espace. Les dates sont de nouveau disponibles.`, `${detail}<br>${escapeHtml(booking.guestEmail)} · ${escapeHtml(booking.guestPhone)}`, adminPayment), settings),
  ]);
}

const bookingStateCopy = (booking: Booking, status: string, outcome?: CancellationOutcome) => {
  const en = booking.locale === "en";
  const detail = bookingMailDetail(booking);
  const hotelCancel = guestCancellationCopy(booking, "hotel", outcome);
  const states: Record<string, { eyebrow: [string, string]; title: [string, string]; body: [string, string]; footer: [string, string]; admin: string }> = {
    confirmed: { eyebrow: ["RÉSERVATION CONFIRMÉE", "BOOKING CONFIRMED"], title: ["Votre séjour est confirmé", "Your stay is confirmed"], body: ["Notre équipe confirme votre réservation. Nous vous attendons aux dates indiquées.", "Our team confirms your booking. We look forward to welcoming you on the dates below."], footer: ["Notre équipe reste à votre disposition.", "Our team remains at your disposal."], admin: `${booking.guestName} a une réservation confirmée.` },
    cancelled: { eyebrow: ["RÉSERVATION ANNULÉE", "BOOKING CANCELLED"], title: ["Votre réservation est annulée", "Your booking has been cancelled"], body: [hotelCancel.body, hotelCancel.body], footer: [hotelCancel.footer, hotelCancel.footer], admin: `L’hôtel a annulé la réservation de ${booking.guestName}. Les dates sont de nouveau disponibles.` },
    checked_in: { eyebrow: ["SÉJOUR EN COURS", "STAY IN PROGRESS"], title: ["Bienvenue", "Welcome"], body: ["Votre arrivée est enregistrée. Nous vous souhaitons un excellent séjour.", "Your arrival has been recorded. We wish you a wonderful stay."], footer: ["Notre équipe reste à votre disposition.", "Our team remains at your disposal."], admin: `${booking.guestName} est arrivé.` },
    checked_out: { eyebrow: ["SÉJOUR TERMINÉ", "STAY COMPLETED"], title: ["Merci de votre visite", "Thank you for staying with us"], body: ["Votre séjour est terminé. Nous espérons vous revoir bientôt.", "Your stay is complete. We hope to welcome you again soon."], footer: ["Notre équipe reste à votre disposition.", "Our team remains at your disposal."], admin: `Le séjour de ${booking.guestName} est terminé.` },
    paid: { eyebrow: ["PAIEMENT REÇU", "PAYMENT RECEIVED"], title: ["Merci pour votre paiement", "Thank you for your payment"], body: ["Votre paiement a bien été reçu. Notre équipe confirme le suivi de votre réservation.", "Your payment has been received. Our team is following up on your booking."], footer: ["Notre équipe reste à votre disposition.", "Our team remains at your disposal."], admin: `${booking.guestName} a réglé ${formatXaf(booking.total, "fr")}.` },
  };
  const state = states[status] || { eyebrow: ["MISE À JOUR", "UPDATE"], title: ["Des nouvelles de votre réservation", "News about your booking"], body: ["Le statut de votre réservation a été mis à jour.", "The status of your booking has been updated."], footer: ["Notre équipe reste à votre disposition.", "Our team remains at your disposal."], admin: `La réservation de ${booking.guestName} a changé d’état (${status}).` };
  return { en, detail, state };
};

export async function sendBookingStateEmails(booking: Booking, settings: HotelSettings, status: string, origin = "", outcome?: CancellationOutcome, pdf?: Uint8Array) {
  const { en, detail, state } = bookingStateCopy(booking, status, outcome);
  const attachment = pdf ? [{ filename: `${booking.reference || "reservation"}-confirmation.pdf`, content: Buffer.from(pdf) }] : undefined;
  const index = en ? 1 : 0;
  const adminPayment = status === "cancelled" ? adminCancellationPaymentNote(booking, outcome) : "Retrouvez cette réservation dans le backoffice.";
  await Promise.all([
    sendHotelMail(booking.guestEmail, `${booking.reference} · ${state.title[index]} · ${settings.hotelName}`, template({ ...settings, mailOrigin: origin }, state.eyebrow[index], state.title[index], en ? `Dear ${booking.guestName},` : `Cher/chère ${booking.guestName},`, state.body[index], detail, state.footer[index]), settings, attachment),
    sendHotelMail(settings.email, `${booking.reference} · ${state.eyebrow[0]} · ${booking.guestName}`, template({ ...settings, mailOrigin: origin }, state.eyebrow[0], state.title[0], `Bonjour l’équipe ${settings.hotelName},`, state.admin, `${detail}<br>${escapeHtml(booking.guestEmail)} · ${escapeHtml(booking.guestPhone)}`, adminPayment), settings, attachment),
  ]);
}

const quoteStateCopy = (quote: QuoteRequest, status: string) => {
  const en = quote.locale === "en";
  const detail = quoteMailDetail(quote);
  const states: Record<string, { eyebrow: [string, string]; title: [string, string]; body: [string, string]; admin: string }> = {
    in_review: { eyebrow: ["DEVIS EN ÉTUDE", "QUOTE UNDER REVIEW"], title: ["Votre demande est à l’étude", "Your request is under review"], body: ["Notre équipe prépare une proposition adaptée à votre objet.", "Our team is preparing a proposal tailored to your plans."], admin: `${quote.guestName} attend l’étude de son devis.` },
    quote_sent: { eyebrow: ["DEVIS ENVOYÉ", "QUOTE SENT"], title: ["Le devis a été transmis", "The quote has been sent"], body: ["Votre proposition personnalisée est disponible.", "Your personalized proposal is available."], admin: `Le devis de ${quote.guestName} a été envoyé.` },
    negotiating: { eyebrow: ["DEVIS EN DISCUSSION", "QUOTE UNDER DISCUSSION"], title: ["Votre devis est en discussion", "Your quote is under discussion"], body: ["Nous restons à votre écoute pour ajuster la proposition.", "We remain available to adjust the proposal."], admin: `Le devis de ${quote.guestName} est en discussion.` },
    accepted: { eyebrow: ["DEVIS ACCEPTÉ", "QUOTE ACCEPTED"], title: ["Votre acceptation est enregistrée", "Your acceptance is confirmed"], body: ["Merci. Votre acceptation est enregistrée. Le devis signé est joint à cet e-mail lorsqu’il est disponible.", "Thank you. Your acceptance is recorded. The signed quote is attached when available."], admin: `${quote.guestName} a accepté le devis${quote.amountTtc ? ` de ${formatXaf(quote.amountTtc, "fr")}` : ""}.` },
    rejected: { eyebrow: ["DEVIS REFUSÉ", "QUOTE DECLINED"], title: ["Votre devis a été refusé", "Your quote has been declined"], body: ["Cette proposition n’est plus d’actualité. Notre équipe reste disponible pour un nouvel objet.", "This proposal is no longer active. Our team remains available for a new project."], admin: `Le devis de ${quote.guestName} a été refusé.` },
    expired: { eyebrow: ["DEVIS EXPIRÉ", "QUOTE EXPIRED"], title: ["Votre devis a expiré", "Your quote has expired"], body: ["La date de validité est dépassée. Contactez-nous si vous souhaitez une nouvelle proposition.", "The validity date has passed. Contact us if you would like a new proposal."], admin: `Le devis de ${quote.guestName} a expiré.` },
  };
  const state = states[status] || { eyebrow: ["MISE À JOUR", "UPDATE"], title: ["Des nouvelles de votre devis", "News about your quote"], body: ["Le statut de votre devis a été mis à jour.", "The status of your quote has been updated."], admin: `Le devis de ${quote.guestName} a changé d’état (${status}).` };
  return { en, detail, state };
};

export async function sendQuoteStateEmails(quote: QuoteRequest, settings: HotelSettings, status: string, attachments?: Mail.Attachment[], origin = "") {
  const { en, detail, state } = quoteStateCopy(quote, status);
  const index = en ? 1 : 0;
  await Promise.all([
    sendHotelMail(quote.guestEmail, `${quote.reference} · ${state.title[index]} · ${settings.hotelName}`, template({ ...settings, mailOrigin: origin }, state.eyebrow[index], state.title[index], en ? `Dear ${quote.guestName},` : `Cher/chère ${quote.guestName},`, state.body[index], detail, en ? "Our team remains at your disposal." : "Notre équipe reste à votre disposition."), settings, attachments),
    sendHotelMail(settings.email, `${quote.reference} · ${state.eyebrow[0]} · ${quote.guestName}`, template({ ...settings, mailOrigin: origin }, state.eyebrow[0], state.title[0], `Bonjour l’équipe ${settings.hotelName},`, state.admin, `${detail}<br>${escapeHtml(quote.guestEmail)} · ${escapeHtml(quote.guestPhone)}`, "Retrouvez ce devis dans le backoffice."), settings, attachments),
  ]);
}

export async function sendStatusEmail(to: string, name: string, reference: string, status: string, kind: "booking" | "quote", locale: string, settings: HotelSettings, origin = "") {
  const en = locale === "en";
  const label: Record<string, [string, string]> = { confirmed: ["confirmée", "confirmed"], cancelled: ["annulée", "cancelled"], rejected: ["refusée", "declined"], accepted: ["accepté", "accepted"], negotiating: ["en discussion", "under discussion"], expired: ["expiré", "expired"] };
  const state = label[status]?.[en ? 1 : 0] || status;
  await sendHotelMail(to, `${reference} · ${en ? "Update" : "Mise à jour"} · ${settings.hotelName}`, template({ ...settings, mailOrigin: origin }, en ? "UPDATE" : "MISE À JOUR", en ? "News about your request" : "Des nouvelles de votre demande", en ? `Dear ${name},` : `Cher/chère ${name},`, en ? `The status of your ${kind === "booking" ? "booking" : "quote"} has been updated.` : `Le statut de votre ${kind === "booking" ? "réservation" : "devis"} a été mis à jour.`, `<strong>${escapeHtml(reference)}</strong><br>${en ? "Status" : "Statut"} : ${escapeHtml(state)}`, en ? "Our team is here if you have any questions." : "Notre équipe reste à votre disposition pour toute question."), settings);
}
