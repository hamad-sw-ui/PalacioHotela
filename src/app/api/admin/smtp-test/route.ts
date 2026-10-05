import { z } from "zod";
import { getAdminForMutation } from "@/lib/auth";
import { getSettings, logActivity } from "@/lib/hotel";
import { probeSmtp, smtpEnvFromSettings } from "@/lib/smtp";

export const dynamic = "force-dynamic";

const draftSchema = z.object({
  send: z.boolean().optional(),
  host: z.string().max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  requireTls: z.boolean().optional(),
  user: z.string().max(255).optional(),
  password: z.string().max(500).optional(),
  from: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const admin = await getAdminForMutation();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role !== "admin") return Response.json({ error: "Droits administrateur requis." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const draft = draftSchema.parse(body);
  const stored = await getSettings();
  const hasDraft = ["host", "port", "secure", "requireTls", "user", "password", "from"].some((key) => Object.prototype.hasOwnProperty.call(body, key));
  const source = hasDraft ? {
    smtpHost: draft.host ?? stored.smtpHost,
    smtpPort: draft.port ?? stored.smtpPort,
    smtpSecure: draft.secure ?? stored.smtpSecure,
    smtpRequireTls: draft.requireTls ?? stored.smtpRequireTls,
    smtpUser: draft.user ?? stored.smtpUser,
    smtpPassword: draft.password || stored.smtpPassword,
    smtpFrom: draft.from ?? stored.smtpFrom,
  } : stored;
  const result = await probeSmtp({
    hotelName: stored.hotelName,
    hotelEmail: stored.email,
    send: draft.send === true,
    to: draft.send === true ? admin.email || stored.email : undefined,
    env: smtpEnvFromSettings(source),
  });
  if (result.verified) {
    try {
      await logActivity("test", "settings", 1, admin.fullName, admin.id, result.sent && "to" in result ? `E-mail d'essai envoyé à ${result.to}` : "Connexion SMTP vérifiée");
    } catch { /* The journal is optional; the probe result still stands. */ }
  }
  const status = result.code === "failed" || result.code === "send_failed" ? 502 : 200;
  return Response.json(result, { status });
}
