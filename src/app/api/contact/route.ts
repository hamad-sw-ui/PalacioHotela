import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { getSettings, logActivity, notifyAdmin } from "@/lib/hotel";
import { emailLogoDelivery, themedEmailHtml } from "@/lib/email-theme";
import { sendHotelMail } from "@/lib/mail";
import { contactInput, parseError } from "@/lib/validation";

const safe = (value: string) => value.replace(/[&<>"']/g, (v) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[v] || v);

export async function POST(request: Request) {
  try {
    const input = contactInput.parse(await request.json());
    const [message] = await db.insert(contactMessages).values(input).returning();
    const settings = await getSettings();
    await notifyAdmin("message", `Nouveau message · ${input.subject}`, `${input.name} · ${input.email}`, `/admin?section=messages&message=${message.id}`);
    await logActivity("Message de contact", "message", message.id, input.name);
    await Promise.all([
      sendHotelMail(settings.email, `Message de ${input.name} · ${input.subject}`, themedEmailHtml(settings.theme, { eyebrow: "NOUVEAU MESSAGE", title: "Nouveau message", greeting: "Bonjour l’équipe Palacio,", body: "Un visiteur vient d’écrire depuis le site.", detail: `<strong>${safe(input.name)}</strong> · ${safe(input.email)} · ${safe(input.phone || "")}<br>${safe(input.subject)}<br><span style="white-space:pre-line">${safe(input.message)}</span>`, footer: "Retrouvez ce message dans votre espace Palacio.", hotelName: settings.hotelName, address: settings.addressFr, phone: settings.phone, email: settings.email }, settings.themeColors, emailLogoDelivery(settings.logoUrl, new URL(request.url).origin)), settings),
      sendHotelMail(input.email, `Votre message à Palacio Hotel · ${input.subject}`, themedEmailHtml(settings.theme, { eyebrow: "MESSAGE REÇU", title: `Merci ${input.name}`, greeting: `Bonjour ${input.name},`, body: "Nous avons bien reçu votre message. L’équipe Palacio reviendra vers vous dans les meilleurs délais.", detail: `<strong>${safe(input.subject)}</strong>`, footer: "À très bientôt.", hotelName: settings.hotelName, address: settings.addressFr, phone: settings.phone, email: settings.email }, settings.themeColors, emailLogoDelivery(settings.logoUrl, new URL(request.url).origin)), settings),
    ]);
    return Response.json({ ok: true, id: message.id }, { status: 201 });
  } catch (error) { return Response.json({ error: parseError(error) }, { status: 400 }); }
}
