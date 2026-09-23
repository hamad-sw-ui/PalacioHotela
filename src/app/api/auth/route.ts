import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clearSession, createSessionToken, getCurrentUser, hashPassword, setSession, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/hotel";
import { ensureAdminAccount, ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const publicUser = (user: { id: number; fullName: string; email: string; role: string; locale: string }) => ({ id: user.id, fullName: user.fullName, email: user.email, role: user.role, locale: user.locale });
const noStore = { "Cache-Control": "no-store" };

// Tolerates stray spaces or capitals that browsers, keyboards and copy-paste can introduce.
const emailField = z.preprocess((value) => typeof value === "string" ? value.trim().toLowerCase() : value, z.email().max(255));

export async function GET() {
  const user = await getCurrentUser();
  // A fresh token lets a cookie-based session also authenticate with the bearer fallback.
  return Response.json({ user: user ? publicUser(user) : null, token: user ? createSessionToken(user.id) : null }, { headers: noStore });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body?.action === "logout") { await clearSession(); return Response.json({ ok: true }, { headers: noStore }); }
    await ensureSeeded();
    await ensureAdminAccount();
    const parsed = z.object({ action: z.enum(["login", "register"]), email: emailField, password: z.string().min(1).max(200), fullName: z.string().trim().min(2).max(180).optional(), phone: z.string().trim().max(60).optional(), locale: z.enum(["fr", "en"]).optional() }).parse(body);
    if (parsed.action === "register") {
      if (!parsed.fullName) return Response.json({ error: "Le nom est requis." }, { status: 400 });
      if (parsed.password.length < 8) return Response.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.email)).limit(1);
      if (existing) return Response.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });
      const [user] = await db.insert(users).values({ fullName: parsed.fullName, email: parsed.email, phone: parsed.phone, passwordHash: hashPassword(parsed.password), role: "guest", locale: parsed.locale || "fr" }).returning();
      const token = await setSession(user.id);
      await logActivity("Création de compte", "user", user.id, user.fullName, user.id);
      return Response.json({ ok: true, token, user: publicUser(user) }, { headers: noStore });
    }
    const [user] = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
    const trimmed = parsed.password.trim();
    const passwordOk = Boolean(user) && (verifyPassword(parsed.password, user.passwordHash) || (trimmed !== parsed.password && verifyPassword(trimmed, user.passwordHash)));
    if (!user || !user.active || !passwordOk) return Response.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
    const token = await setSession(user.id);
    await logActivity("Connexion", "user", user.id, user.fullName, user.id);
    return Response.json({ ok: true, token, user: publicUser(user) }, { headers: noStore });
  } catch (error) {
    console.error("[Palacio] Auth error:", error);
    return Response.json({ error: "Vérifiez les informations saisies." }, { status: 400 });
  }
}
