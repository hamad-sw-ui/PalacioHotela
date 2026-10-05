import { z } from "zod";
import { getAdminForMutation } from "@/lib/auth";
import { getSettings, logActivity } from "@/lib/hotel";
import { probeGoogle } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

const draftSchema = z.object({
  clientId: z.string().max(300).optional(),
  clientSecret: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const admin = await getAdminForMutation();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role !== "admin") return Response.json({ error: "Droits administrateur requis." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const draft = draftSchema.parse(body);
  const stored = await getSettings();
  const source = {
    googleClientId: draft.clientId?.trim() || stored.googleClientId,
    googleClientSecret: draft.clientSecret?.trim() || stored.googleClientSecret,
  };
  if (!source.googleClientId) {
    return Response.json({ configured: false, verified: false, code: "missing" });
  }
  const result = await probeGoogle({ settings: source });
  if (result.verified) {
    try {
      await logActivity("test", "settings", 1, admin.fullName, admin.id, "Identifiants Google OAuth vérifiés");
    } catch { /* The journal is optional; the probe result still stands. */ }
  }
  const status = result.code === "unavailable" ? 503 : result.code === "invalid_id" || result.code === "invalid_credentials" ? 422 : 200;
  return Response.json(result, { status });
}