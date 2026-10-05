import { cookies } from "next/headers";
import { getSettings } from "@/lib/hotel";
import { GOOGLE_STATE_COOKIE, googleAuthorizeUrl, googleCredentials, googleEnvFromSettings, googleRedirectUri, googleReturnPath, signGoogleState } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

function stateSecret() {
  return process.env.SESSION_SECRET || process.env.DATABASE_URL || "palacio-local-session-key";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/compte", url.origin);
  const credentials = googleCredentials(googleEnvFromSettings(await getSettings()));
  if (!credentials) {
    destination.searchParams.set("google", "unavailable");
    return Response.redirect(destination, 303);
  }
  const redirectUri = googleRedirectUri(url.origin);
  if (!redirectUri) {
    destination.searchParams.set("google", "unavailable");
    return Response.redirect(destination, 303);
  }
  const locale = url.searchParams.get("locale") === "en" ? "en" : "fr";
  const next = googleReturnPath(url.searchParams.get("next"));
  const state = signGoogleState({ next, locale }, stateSecret());
  const jar = await cookies();
  jar.set(GOOGLE_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: redirectUri.startsWith("https:"), path: "/", maxAge: 600 });
  return Response.redirect(googleAuthorizeUrl({ clientId: credentials.clientId, redirectUri, state }), 303);
}
