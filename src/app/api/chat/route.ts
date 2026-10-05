import { z } from "zod";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { chatCompletionsUrl, geminiChatOptions, GEMINI_DEFAULT_MODEL, resolveAiConfig, type AiEnv } from "@/lib/ai-provider";
import { getPublicCatalog, getSettings, formatXaf, notifyAdmin } from "@/lib/hotel";

const inputSchema = z.object({ locale: z.enum(["fr", "en"]).default("fr"), messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1000) })).min(1).max(10) });

function localAnswer(message: string, locale: string, items: Awaited<ReturnType<typeof getPublicCatalog>>, settings: Awaited<ReturnType<typeof getSettings>>) {
  const en = locale === "en";
  const lower = message.toLowerCase();
  const choose = (category: string) => items.filter((item) => item.category === category).slice(0, 3);
  if (/tarif|prix|coût|price|cost|chambre|room|suite|héberg|stay|nuit/.test(lower)) {
    const rooms = choose("accommodation");
    return `${en ? "Our rooms are designed for every kind of stay" : "Nos chambres sont pensées pour tous les séjours"} : ${rooms.map((r) => `${en ? r.nameEn : r.nameFr} (${formatXaf(r.price, locale)}${en ? "/night" : "/nuit"})`).join(", ")}. ${en ? "Would you like to check availability or request a tailored quote?" : "Souhaitez-vous vérifier les disponibilités ou demander un devis sur mesure ?"}`;
  }
  if (/confér|sémin|meeting|conference|réunion|évén|fête|mariage|event|wedding|salle|hall/.test(lower)) {
    return en ? "For your conferences and celebrations, our Acacia room and Starlight hall can be tailored to your event. Share your date and number of guests through our quote form, and our team will prepare a personalized proposal." : "Pour vos conférences et célébrations, le Salon Acacia et la Salle des Étoiles s’adaptent à votre événement. Indiquez votre date et le nombre d’invités dans notre formulaire de devis : notre équipe vous préparera une offre personnalisée.";
  }
  if (/devis|quote|estimate|proposition/.test(lower)) return en ? "Request a free personalized quote on the Quote page. Choose your accommodation, event space or experience, share your dates and needs, and our team will reply with a PDF quote in XAF." : "Demandez un devis personnalisé sur la page Devis. Choisissez votre hébergement, une salle ou un service, indiquez vos dates et vos besoins : notre équipe vous transmettra un devis PDF en XAF TTC.";
  if (/paiement|payment|carte|paypal|cash|espèce/.test(lower)) return en ? "You can request to pay by card, PayPal (when enabled), or at the hotel in cash. Online payment availability depends on the hotel's payment setup; bookings remain subject to team confirmation." : "Vous pouvez choisir la carte bancaire, PayPal (si activé) ou le paiement en espèces à l’hôtel. Les paiements en ligne dépendent de la configuration de l’établissement ; la réservation reste soumise à confirmation.";
  if (/adresse|où|localis|map|where|address|contact|whatsapp|téléphone/.test(lower)) return `${en ? "Find us at" : "Retrouvez-nous à"} ${en ? settings.addressEn : settings.addressFr}. ${en ? "Call us" : "Appelez-nous au"} ${settings.phone} ${en ? "or contact us on WhatsApp" : "ou écrivez-nous sur WhatsApp"}.`;
  if (/spa|restaurant|dîn|dining|loisir|activity|expérience|experience/.test(lower)) return en ? "Enjoy our spa, seasonal dining at La Table du Palacio, and tailored experiences at the hotel. You can add these to a quote request or reserve a moment just for you." : "Profitez de notre spa, de la cuisine de saison à La Table du Palacio et de nos expériences sur mesure. Ajoutez ces expériences à votre devis ou réservez un moment pour vous.";
  return en ? "Welcome to Palacio Hotel! I can help you explore our rooms, event spaces, dining, experiences, rates and quote requests. What would you like to know?" : "Bienvenue au Palacio Hotel ! Je peux vous guider parmi nos chambres, espaces événementiels, restaurants, expériences, tarifs et demandes de devis. Que souhaitez-vous découvrir ?";
}

async function rememberConversation(question: string, reply: string) {
  try {
    const [row] = await db.insert(contactMessages).values({ name: "Visiteur du site", email: "visiteur@assistant.local", subject: "Assistant du site", message: `Visiteur : ${question}\n\nAssistant : ${reply}`.slice(0, 4000), status: "new" }).returning({ id: contactMessages.id });
    await notifyAdmin("message", "Assistant du site", question.slice(0, 180), `/admin?section=messages&message=${row.id}`);
  } catch (error) {
    console.error("[Palacio] Assistant message:", error);
  }
}

export async function POST(request: Request) {
  try {
    const { messages, locale } = inputSchema.parse(await request.json());
    const settings = await getSettings();
    const catalog = await getPublicCatalog();
    const ai = resolveAiConfig(settings, process.env as unknown as AiEnv, "chat");
    const provider = ai.provider;
    const key = ai.key;
    const baseUrl = ai.baseUrl;
    const model = ai.model;
    const context = catalog.map((item) => `${item.nameFr} / ${item.nameEn} (${item.category}): ${formatXaf(item.price)} par ${item.pricingUnit}, capacité ${item.capacity}`).join("; ");
    const system = `You are Palacio Hotel's helpful bilingual concierge. Reply only in ${locale === "en" ? "English" : "French"}. Be warm, concise and accurate. Hotel: ${settings.addressFr}, ${settings.phone}, email ${settings.email}. Catalog: ${context}. Quotes are personalized, XAF TTC, final price set by hotel staff. Booking availability must be verified on the website. Never claim a booking or payment is confirmed. Encourage /devis or /reservation when appropriate. Never invent prices or availability.`;
    if ((provider === "openai" || provider === "gemini" || provider === "auto" && key) && key) {
      try {
        const response = await fetch(chatCompletionsUrl(baseUrl, provider), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: model || (provider === "gemini" ? GEMINI_DEFAULT_MODEL : "gpt-4o-mini"), temperature: 0.5, max_tokens: provider === "gemini" ? 512 : 280, ...geminiChatOptions(provider, baseUrl), messages: [{ role: "system", content: system }, ...messages] }), signal: AbortSignal.timeout(20000) });
        if (response.ok) { const data = await response.json() as { choices?: { message?: { content?: string } }[] }; const reply = data.choices?.[0]?.message?.content; if (reply) { await rememberConversation(messages.at(-1)?.content || "", reply); return Response.json({ reply, source: "ai" }); } }
      } catch (error) { console.error("[Palacio] AI provider unavailable:", error); }
    }
    if (provider === "ollama" || provider === "auto" && baseUrl && !key) {
      try {
        const response = await fetch(`${baseUrl || "http://127.0.0.1:11434"}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: model || "llama3.2", stream: false, messages: [{ role: "system", content: system }, ...messages] }), signal: AbortSignal.timeout(12000) });
        if (response.ok) { const data = await response.json() as { message?: { content?: string } }; const reply = data.message?.content; if (reply) { await rememberConversation(messages.at(-1)?.content || "", reply); return Response.json({ reply, source: "ai" }); } }
      } catch (error) { console.error("[Palacio] Local AI unavailable:", error); }
    }
    const reply = localAnswer(messages.at(-1)?.content || "", locale, catalog, settings);
    await rememberConversation(messages.at(-1)?.content || "", reply);
    return Response.json({ reply, source: "local" });
  } catch { return Response.json({ error: "Message invalide." }, { status: 400 }); }
}
