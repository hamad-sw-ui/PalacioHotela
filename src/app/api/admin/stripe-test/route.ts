import { z } from "zod";
import { getAdminForMutation } from "@/lib/auth";
import { getSettings, logActivity } from "@/lib/hotel";
import { probeStripe } from "@/lib/payments";

export const dynamic = "force-dynamic";

const draftSchema = z.object({
  secretKey: z.string().max(500).optional(),
  webhookSecret: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const admin = await getAdminForMutation();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role !== "admin") return Response.json({ error: "Droits administrateur requis." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const draft = draftSchema.parse(body);
  const stored = await getSettings();
  const result = await probeStripe({
    settings: {
      stripeSecretKey: draft.secretKey?.trim() || stored.stripeSecretKey,
      stripeWebhookSecret: draft.webhookSecret?.trim() || stored.stripeWebhookSecret,
    },
  });
  if (result.verified) {
    try {
      await logActivity("test", "settings", 1, admin.fullName, admin.id, result.code === "key_only" ? "Clé Stripe vérifiée, webhook encore à renseigner" : "Connexion Stripe vérifiée");
    } catch { /* The journal is optional; the probe result still stands. */ }
  }
  const status = result.code === "failed" ? 502 : 200;
  return Response.json(result, { status });
}
