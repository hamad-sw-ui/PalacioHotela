import { z } from "zod";
import { getPublicCatalog, getSettings, formatXaf } from "@/lib/hotel";

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

export async function POST(request: Request) {
  try {
    const { messages, locale } = inputSchema.parse(await request.json());
    const settings = await getSettings();
    const catalog = await getPublicCatalog();
    const provider = process.env.AI_PROVIDER || settings.aiProvider;
    const key = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const baseUrl = (process.env.AI_BASE_URL || settings.aiBaseUrl || "").replace(/\/$/, "");
    const model = process.env.AI_MODEL || settings.aiModel;
    const context = catalog.map((item) => `${item.nameFr} / ${item.nameEn} (${item.category}): ${formatXaf(item.price)} par ${item.pricingUnit}, capacité ${item.capacity}`).join("; ");
    const system = `You are Palacio Hotel's helpful bilingual concierge. Reply only in ${locale === "en" ? "English" : "French"}. Be warm, concise and accurate. Hotel: ${settings.addressFr}, ${settings.phone}, email ${settings.email}. Catalog: ${context}. Quotes are personalized, XAF TTC, final price set by hotel staff. Booking availability must be verified on the website. Never claim a booking or payment is confirmed. Encourage /devis or /reservation when appropriate. Never invent prices or availability.`;
    if ((provider === "openai" || provider === "auto" && key) && key) {
      try {
        const response = await fetch(`${baseUrl || "https://api.openai.com"}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: model || "gpt-4o-mini", temperature: 0.5, max_tokens: 280, messages: [{ role: "system", content: system }, ...messages] }), signal: AbortSignal.timeout(12000) });
        if (response.ok) { const data = await response.json() as { choices?: { message?: { content?: string } }[] }; if (data.choices?.[0]?.message?.content) return Response.json({ reply: data.choices[0].message.content, source: "ai" }); }
      } catch (error) { console.error("[Palacio] AI provider unavailable:", error); }
    }
    if (provider === "ollama" || provider === "auto" && baseUrl && !key) {
      try {
        const response = await fetch(`${baseUrl || "http://127.0.0.1:11434"}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: model || "llama3.2", stream: false, messages: [{ role: "system", content: system }, ...messages] }), signal: AbortSignal.timeout(12000) });
        if (response.ok) { const data = await response.json() as { message?: { content?: string } }; if (data.message?.content) return Response.json({ reply: data.message.content, source: "ai" }); }
      } catch (error) { console.error("[Palacio] Local AI unavailable:", error); }
    }
    return Response.json({ reply: localAnswer(messages.at(-1)?.content || "", locale, catalog, settings), source: "local" });
  } catch { return Response.json({ error: "Message invalide." }, { status: 400 }); }
}
