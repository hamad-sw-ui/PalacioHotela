import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { getSettings, logActivity, notifyAdmin } from "@/lib/hotel";
import { sendHotelMail } from "@/lib/mail";
import { contactInput, parseError } from "@/lib/validation";

const safe = (value: string) => value.replace(/[&<>"']/g, (v) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[v] || v);

export async function POST(request: Request) {
  try {
    const input = contactInput.parse(await request.json());
    const [message] = await db.insert(contactMessages).values(input).returning();
    const settings = await getSettings();
    await notifyAdmin("message", `Nouveau message · ${input.subject}`, `${input.name} · ${input.email}`, "/admin?section=messages");
    await logActivity("Message de contact", "message", message.id, input.name);
    await Promise.all([
      sendHotelMail(settings.email, `Message de ${input.name} · ${input.subject}`, `<div style="font-family:Arial,sans-serif;background:#f6f4ee;padding:36px"><div style="max-width:580px;margin:auto;background:white;padding:36px;border-top:5px solid #204334"><h1 style="font-family:Georgia,serif;color:#204334">Nouveau message</h1><p><strong>${safe(input.name)}</strong> · ${safe(input.email)} · ${safe(input.phone || "")}</p><h3>${safe(input.subject)}</h3><p style="white-space:pre-line;line-height:1.7">${safe(input.message)}</p><p>Retrouvez ce message dans votre espace Palacio.</p></div></div>`, settings),
      sendHotelMail(input.email, `Votre message à Palacio Hotel · ${input.subject}`, `<div style="font-family:Arial,sans-serif;background:#f6f4ee;padding:36px"><div style="max-width:580px;margin:auto;background:white;padding:36px;border-top:5px solid #204334"><h1 style="font-family:Georgia,serif;color:#204334">Merci ${safe(input.name)}</h1><p style="line-height:1.7">Nous avons bien reçu votre message. L’équipe Palacio reviendra vers vous dans les meilleurs délais.</p><p style="background:#f5f6f2;padding:18px;color:#204334">${safe(input.subject)}</p><p>À très bientôt,<br>L’équipe Palacio Hotel</p></div></div>`, settings),
    ]);
    return Response.json({ ok: true, id: message.id }, { status: 201 });
  } catch (error) { return Response.json({ error: parseError(error) }, { status: 400 }); }
}
