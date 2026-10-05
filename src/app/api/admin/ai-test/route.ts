import { z } from "zod";
import { probeAi } from "@/lib/ai-provider";
import { getAdminForMutation } from "@/lib/auth";
import { getSettings, logActivity } from "@/lib/hotel";

export const dynamic = "force-dynamic";

const draftSchema = z.object({
  provider: z.enum(["auto", "openai", "ollama", "local", "gemini"]).optional(),
  baseUrl: z.string().max(500).optional(),
  model: z.string().max(120).optional(),
  apiKey: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const admin = await getAdminForMutation();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role !== "admin") return Response.json({ error: "Droits administrateur requis." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const draft = draftSchema.parse(body);
  const stored = await getSettings();
  const result = await probeAi({
    settings: {
      aiProvider: draft.provider ?? stored.aiProvider,
      aiBaseUrl: draft.baseUrl ?? stored.aiBaseUrl,
      aiModel: draft.model ?? stored.aiModel,
      aiApiKey: draft.apiKey?.trim() || stored.aiApiKey,
    },
  });
  if (result.verified) {
    try {
      await logActivity("test", "settings", 1, admin.fullName, admin.id, result.code === "local" ? "Assistant local vérifié" : `Connexion ${result.provider} vérifiée${result.model ? ` · ${result.model}` : ""}`);
    } catch { /* The journal is optional; the probe result still stands. */ }
  }
  const status = result.code === "failed" ? 502 : 200;
  return Response.json(result, { status });
}
