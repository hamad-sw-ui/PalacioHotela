import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setSession } from "@/lib/auth";
import { GOOGLE_STATE_COOKIE, decideGoogleAccount, fetchGoogleIdentity, googleCredentials, googleEnvFromSettings, googleLinkUpdate, googleNewUser, googleRedirectUri, googleReturnPath, readGoogleState } from "@/lib/google-auth";
import { getSettings, logActivity } from "@/lib/hotel";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

function stateSecret() {
  return process.env.SESSION_SECRET || process.env.DATABASE_URL || "palacio-local-session-key";
}

function back(origin: string, reason: string) {
  const url = new URL("/compte", origin);
  url.searchParams.set("google", reason);
  return Response.redirect(url, 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUri = googleRedirectUri(url.origin);
  const appOrigin = redirectUri ? new URL(redirectUri).origin : url.origin;
  const jar = await cookies();
  const stored = jar.get(GOOGLE_STATE_COOKIE)?.value || "";
  jar.set(GOOGLE_STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: redirectUri?.startsWith("https:") ?? url.protocol === "https:", path: "/", maxAge: 0 });
  const queryState = url.searchParams.get("state") || "";
  if (url.searchParams.get("error") === "access_denied") return back(appOrigin, "denied");
  const state = stored && stored === queryState ? readGoogleState(stored, stateSecret()) : null;
  if (!state) return back(appOrigin, "failed");
  const code = url.searchParams.get("code") || "";
  const credentials = googleCredentials(googleEnvFromSettings(await getSettings()));
  if (!code || !credentials || !redirectUri) return back(appOrigin, "failed");
  const fetched = await fetchGoogleIdentity({ code, clientId: credentials.clientId, clientSecret: credentials.clientSecret, redirectUri });
  if (!fetched.ok) return back(appOrigin, fetched.reason === "unverified" ? "unverified" : "failed");
  try {
    await ensureSeeded();
    const { identity } = fetched;
    const [bySub] = await db.select().from(users).where(eq(users.googleSub, identity.sub)).limit(1);
    const [byEmail] = await db.select().from(users).where(eq(users.email, identity.email)).limit(1);
    const decision = decideGoogleAccount(identity, bySub || null, byEmail || null);
    if (decision.action === "refuse") return back(appOrigin, decision.reason);
    let userId = 0;
    const localeParam: "fr" | "en" = state.locale === "en" ? "en" : "fr";
    if (decision.action === "create") {
      const [created] = await db.insert(users).values(googleNewUser(identity, localeParam)).returning();
      userId = created.id;
      await logActivity("Création de compte Google", "user", created.id, created.fullName, created.id);
    } else {
      const link = googleLinkUpdate(decision, identity.sub);
      const [linked] = link
        ? await db.update(users).set(link).where(eq(users.id, decision.userId)).returning()
        : await db.select().from(users).where(eq(users.id, decision.userId)).limit(1);
      if (!linked?.active) return back(appOrigin, "inactive");
      userId = linked.id;
      await logActivity("Connexion Google", "user", linked.id, linked.fullName, linked.id);
    }
    await setSession(userId);
    return Response.redirect(new URL(googleReturnPath(state.next), appOrigin), 303);
  } catch (error) {
    console.error("[Palacio] Google sign-in:", error);
    return back(appOrigin, "failed");
  }
}
