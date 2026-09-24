import { getPublicCatalog, getSettings } from "@/lib/hotel";
import { analyzeQuoteMessage } from "@/lib/ai-provider";
import { quoteAssistantInputSchema } from "@/lib/quote-assistant-schema";

export const dynamic = "force-dynamic";

const windows = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 6;

function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous";
}

function allowed(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const previous = windows.get(key);
  if (!previous || now - previous.startedAt >= WINDOW_MS) { windows.set(key, { startedAt: now, count: 1 }); return true; }
  if (previous.count >= MAX_REQUESTS) return false;
  previous.count += 1;
  return true;
}

export async function POST(request: Request) {
  if (process.env.QUOTE_ASSISTANT_ENABLED === "false") return Response.json({ error: "L’assistant de devis est temporairement indisponible." }, { status: 503 });
  if (!allowed(request)) return Response.json({ error: "Trop de demandes. Réessayez dans une minute." }, { status: 429 });
  try {
    const input = quoteAssistantInputSchema.parse(await request.json());
    const [settings, catalog] = await Promise.all([getSettings(), getPublicCatalog()]);
    const result = await analyzeQuoteMessage({ message: input.message, locale: input.locale, catalog, checkIn: input.checkIn, checkOut: input.checkOut, people: input.people, provider: settings.aiProvider, baseUrl: settings.aiBaseUrl, model: settings.aiModel });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Demande invalide." }, { status: 400 });
  }
}
