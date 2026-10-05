import { z } from "zod";
import { getAdminForMutation } from "@/lib/auth";
import { getSettings, logActivity } from "@/lib/hotel";
import { probePaypal } from "@/lib/payments";

export const dynamic = "force-dynamic";

const draftSchema = z.object({
  clientId: z.string().max(300).optional(),
  clientSecret: z.string().max(500).optional(),
  envMode: z.enum(["sandbox", "live"]).optional(),
  xafPerEur: z.coerce.number().min(0).max(10000).optional(),
});

export async function POST(request: Request) {
  const admin = await getAdminForMutation();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role !== "admin") return Response.json({ error: "Droits administrateur requis." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const draft = draftSchema.parse(body);
  const stored = await getSettings();
  const result = await probePaypal({
    settings: {
      paypalClientId: draft.clientId?.trim() || stored.paypalClientId,
      paypalClientSecret: draft.clientSecret?.trim() || stored.paypalClientSecret,
      paypalEnv: draft.envMode || stored.paypalEnv,
      paypalXafPerEur: draft.xafPerEur || stored.paypalXafPerEur,
    },
  });
  if (result.verified) {
    try {
      await logActivity("test", "settings", 1, admin.fullName, admin.id, `Connexion PayPal vérifiée · ${result.envMode}`);
    } catch { /* The journal is optional; the probe result still stands. */ }
  }
  const status = result.code === "failed" ? 502 : 200;
  return Response.json(result, { status });
}
