import { z } from "zod";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { callAiChat, resolveAiConfig, type AiEnv } from "@/lib/ai-provider";
import { getPublicCatalog, getSettings, formatXaf, notifyAdmin } from "@/lib/hotel";

const inputSchema = z.object({ locale: z.enum(["fr", "en"]).default("fr"), messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1000) })).min(1).max(10) });

function localAnswer(message: string, locale: string, items: Awaited<ReturnType<typeof getPublicCatalog>>, settings: Awaited<ReturnType<typeof getSettings>>) {
  const en = locale === "en";
  const lower = message.toLowerCase();
  const choose = (category: string) => items.filter((item) => item.category === category).slice(0, 3);
  const opening = en ? "I’d be happy to help with that." : "Je serais ravi de vous aider avec cela.";
  const closing = en ? " Would you like to check availability or request a personalized quote?" : " Souhaitez-vous vérifier les disponibilités ou demander un devis personnalisé ?";
  const roomsIntro = en ? "Our rooms are designed for every kind of stay." : "Nos chambres sont pensées pour tous les séjours.";
  const eventsIntro = en ? "For your conferences and celebrations, we have beautiful spaces that can be tailored to your event." : "Pour vos conférences et célébrations, nous disposons de magnifiques espaces qui s’adaptent à votre événement.";
  const quoteIntro = en ? "Requesting a free personalized quote is simple." : "Demander un devis personnalisé et gratuit est simple.";
  const paymentIntro = en ? "You have several payment options available." : "Vous disposez de plusieurs options de paiement.";
  const locationIntro = en ? "You can find us here:" : "Vous pouvez nous trouver ici:";
  const spaIntro = en ? "We offer a range of wellness and dining experiences to make your stay memorable." : "Nous proposons une gamme d’expériences bien-être et gastronomiques pour rendre votre séjour inoubliable.";
  const fallbackIntro = en ? "Welcome to Palacio Hotel!" : "Bienvenue au Palacio Hotel !";
  if (/tarif|prix|coût|price|cost|chambre|room|suite|héberg|stay|nuit/.test(lower)) {
    const rooms = choose("accommodation");
    return `${opening} ${roomsIntro} ${rooms.map((r) => `${en ? r.nameEn : r.nameFr} (${formatXaf(r.price, locale)}${en ? "/night" : "/nuit"})`).join(", ")}.${closing}`;
  }
  if (/confér|sémin|meeting|conference|réunion|évén|fête|mariage|event|wedding|salle|hall/.test(lower)) {
    return `${opening} ${eventsIntro} Share your date and number of guests through our quote form, and our team will prepare a personalized proposal. Indiquez votre date et le nombre d’invités dans notre formulaire de devis : notre équipe vous préparera une offre personnalisée.`;
  }
  if (/devis|quote|estimate|proposition/.test(lower)) return `${opening} ${quoteIntro} Choose your accommodation, event space or experience, share your dates and needs, and our team will reply with a PDF quote in XAF. Choisissez votre hébergement, une salle ou un service, indiquez vos dates et vos besoins : notre équipe vous transmettra un devis PDF en XAF TTC.`;
  if (/paiement|payment|carte|paypal|cash|espèce/.test(lower)) return `${opening} ${paymentIntro} You can choose to pay by card, PayPal (when enabled), or in cash at the hotel. Online payment availability depends on the hotel’s setup; bookings remain subject to team confirmation. Vous pouvez choisir la carte bancaire, PayPal (si activé) ou le paiement en espèces à l’hôtel. Les paiements en ligne dépendent de la configuration de l’établissement ; la réservation reste soumise à confirmation.`;
  if (/adresse|où|localis|map|where|address|contact|whatsapp|téléphone/.test(lower)) return `${opening} ${locationIntro} ${en ? settings.addressEn : settings.addressFr}. ${en ? "Call us" : "Appelez-nous au"} ${settings.phone} ${en ? "or contact us on WhatsApp" : "ou écrivez-nous sur WhatsApp"}.`;
  if (/spa|restaurant|dîn|dining|loisir|activity|expérience|experience/.test(lower)) return `${opening} ${spaIntro} You can add these experiences to a quote request or reserve a moment just for you. Ajoutez ces expériences à votre devis ou réservez un moment pour vous.`;
  return `${fallbackIntro} ${en ? "I can help you explore our rooms, event spaces, dining, experiences, rates and quote requests. What would you like to discover today?" : "Je peux vous guider parmi nos chambres, espaces événementiels, restaurants, expériences, tarifs et demandes de devis. Que souhaitez-vous découvrir aujourd’hui ?"}`;
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
    const hour = new Date().getHours();
    const greeting = locale === "en"
      ? (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening")
      : (hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir");
    const system = `You are Palacio Hotel's warm, attentive bilingual concierge. Reply only in ${locale === "en" ? "English" : "French"}. Start naturally with "${greeting}". Be friendly, courteous, and genuinely helpful—like a hotel receptionist speaking to a guest in person. Use soft, welcoming language; avoid robotic lists and dry bullet points unless truly useful. Hotel: ${settings.addressFr}, ${settings.phone}, email ${settings.email}. Catalog: ${context}. Quotes are personalized, XAF TTC, final price set by hotel staff. Booking availability must be verified on the website. Never claim a booking or payment is confirmed. Encourage /devis or /reservation when appropriate. Never invent prices or availability. If you cannot help, invite the guest to contact the Palacio team directly.`;
    if ((provider === "openai" || provider === "gemini" || provider === "auto" && key) && key) {
      try {
        const reply = await callAiChat([{ role: "system", content: system }, ...messages], { provider, baseUrl, model, key, temperature: 0.5, maxTokens: provider === "gemini" ? 512 : 280 });
        if (reply) { await rememberConversation(messages.at(-1)?.content || "", reply); return Response.json({ reply, source: "ai" }); }
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
