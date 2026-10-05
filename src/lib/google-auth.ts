import { createHmac, timingSafeEqual } from "node:crypto";
import { returnAfterSignIn } from "@/lib/member-gate";

const STATE_MS = 10 * 60 * 1000;
export const GOOGLE_STATE_COOKIE = "palacio_google_state";

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean; name: string };

export type GoogleAccount = {
  id: number;
  email: string;
  googleSub: string | null;
  active: boolean;
  role: string;
  passwordHash: string | null;
};

export type GoogleDecision =
  | { action: "refuse"; reason: "unverified" | "inactive" | "conflict" }
  | { action: "sign-in"; userId: number; linkSub: boolean }
  | { action: "create" };

export type GoogleEnv = { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string };

export type GoogleSettings = { googleClientId?: string; googleClientSecret?: string };

export function isValidGoogleClientId(value: string | null | undefined) {
  return /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value?.trim() || "");
}

export function googleAuthConfigured(env: GoogleEnv = process.env as unknown as GoogleEnv) {
  return Boolean(isValidGoogleClientId(env.GOOGLE_CLIENT_ID) && env.GOOGLE_CLIENT_SECRET?.trim());
}

/** Credentials saved in Admin → Integrations replace the server variables. An empty id keeps the environment. */
export function googleEnvFromSettings(settings: GoogleSettings | null | undefined, env: GoogleEnv = process.env as unknown as GoogleEnv): GoogleEnv {
  const clientId = settings?.googleClientId?.trim() || "";
  if (!clientId) return env;
  return {
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: settings?.googleClientSecret || "",
  };
}

/** The resolved pair, trimmed exactly once, so every caller agrees on what is configured. */
export function googleCredentials(env: GoogleEnv) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (!isValidGoogleClientId(clientId) || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleReturnPath(next: string | null | undefined) {
  return returnAfterSignIn(next) || "/compte";
}

export function googleRedirectUri(origin: string, configured = process.env.GOOGLE_REDIRECT_URI) {
  const callbackPath = "/api/auth/google/callback";
  if (!configured?.trim()) {
    try { return new URL(callbackPath, origin).toString(); } catch { return null; }
  }
  try {
    const redirect = new URL(configured.trim());
    const localHttp = redirect.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname);
    if ((redirect.protocol !== "https:" && !localHttp) || redirect.pathname !== callbackPath || redirect.search || redirect.hash || redirect.username || redirect.password) return null;
    return redirect.toString();
  } catch { return null; }
}

export function signGoogleState(value: { next: string; locale: "fr" | "en" }, secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ next: googleReturnPath(value.next), locale: value.locale, exp: now + STATE_MS })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readGoogleState(token: string, secret: string, now = Date.now()) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("base64url"));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { next?: unknown; locale?: unknown; exp?: unknown };
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    const locale = parsed.locale === "en" ? "en" : "fr";
    return { next: googleReturnPath(typeof parsed.next === "string" ? parsed.next : ""), locale };
  } catch { return null; }
}

function displayName(name: string, email: string) {
  const trimmed = name.trim();
  if (trimmed.length >= 2) return trimmed.slice(0, 180);
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return local && local.length >= 2 ? local.slice(0, 180) : "Client Palacio";
}

export function googleIdentityFromProfile(profile: { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown }): GoogleIdentity | null {
  const sub = typeof profile.sub === "string" ? profile.sub.trim() : "";
  const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
  if (!sub || !email || sub.length > 255 || email.length > 255) return null;
  const verified = profile.email_verified === true || profile.email_verified === "true";
  const name = displayName(typeof profile.name === "string" ? profile.name : "", email);
  return { sub, email, emailVerified: verified, name };
}

/** Attach Google to an existing e-mail, or create a guest. Never changes the password or the role. */
export function decideGoogleAccount(identity: GoogleIdentity, bySub: GoogleAccount | null, byEmail: GoogleAccount | null): GoogleDecision {
  if (!identity.emailVerified) return { action: "refuse", reason: "unverified" };
  if (bySub) {
    if (!bySub.active) return { action: "refuse", reason: "inactive" };
    if (byEmail && byEmail.id !== bySub.id) return { action: "refuse", reason: "conflict" };
    return { action: "sign-in", userId: bySub.id, linkSub: false };
  }
  if (byEmail) {
    if (!byEmail.active) return { action: "refuse", reason: "inactive" };
    if (byEmail.googleSub && byEmail.googleSub !== identity.sub) return { action: "refuse", reason: "conflict" };
    return { action: "sign-in", userId: byEmail.id, linkSub: !byEmail.googleSub };
  }
  return { action: "create" };
}

export function googleLinkUpdate(decision: GoogleDecision, sub: string) {
  if (decision.action === "sign-in" && decision.linkSub) return { googleSub: sub };
  return null;
}

export function googleNewUser(identity: GoogleIdentity, locale: "fr" | "en") {
  return { fullName: identity.name, email: identity.email, phone: null as string | null, country: "", passwordHash: null as string | null, googleSub: identity.sub, role: "guest" as const, locale };
}

export async function fetchGoogleIdentity(input: { code: string; clientId: string; clientSecret: string; redirectUri: string; fetchImpl?: typeof fetch }): Promise<{ ok: true; identity: GoogleIdentity } | { ok: false; reason: "failed" | "unverified" }> {
  const fetchImpl = input.fetchImpl || fetch;
  try {
    const tokenResponse = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: input.code, client_id: input.clientId, client_secret: input.clientSecret, redirect_uri: input.redirectUri, grant_type: "authorization_code" }),
      cache: "no-store",
    });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!tokenResponse.ok || !token.access_token) return { ok: false, reason: "failed" };
    const profileResponse = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" });
    if (!profileResponse.ok) return { ok: false, reason: "failed" };
    const identity = googleIdentityFromProfile(await profileResponse.json() as { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown });
    if (!identity) return { ok: false, reason: "failed" };
    if (!identity.emailVerified) return { ok: false, reason: "unverified" };
    return { ok: true, identity };
  } catch { return { ok: false, reason: "failed" }; }
}

/** Checks the pair against Google without ever returning it. Never performs a redirect. */
export async function probeGoogle(input: { settings?: GoogleSettings | null; env?: GoogleEnv; fetchImpl?: typeof fetch } = {}) {
  const resolved = googleEnvFromSettings(input.settings, input.env ?? (process.env as unknown as GoogleEnv));
  const clientId = resolved.GOOGLE_CLIENT_ID?.trim() || "";
  if (!clientId) return { configured: false, verified: false, code: "missing" as const };
  if (!isValidGoogleClientId(clientId)) return { configured: false, verified: false, code: "invalid_id" as const };
  const clientSecret = resolved.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (!clientSecret) return { configured: false, verified: false, code: "missing" as const };
  const credentials = { clientId, clientSecret };
  const fetchImpl = input.fetchImpl || fetch;
  try {
    // `tokeninfo` only inspects tokens that were already issued and ignores the client pair
    // entirely, so it can never confirm a secret. Google authenticates a client pair while
    // redeeming a code, so the pair is checked with a throwaway code instead: `invalid_client`
    // is the one answer that proves the credentials themselves are wrong, while any other
    // error means Google accepted them and merely rejected the code we made up.
    const response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, grant_type: "authorization_code", code: "palacio-credentials-check" }),
      cache: "no-store",
    });
    if (response.ok) return { configured: true, verified: true, code: "verified" as const };
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (payload?.error === "invalid_client" || payload?.error === "unauthorized_client") {
      return { configured: true, verified: false, code: "invalid_credentials" as const };
    }
    if (!payload?.error || response.status === 429 || response.status >= 500) return { configured: true, verified: false, code: "unavailable" as const };
    return { configured: true, verified: true, code: "verified" as const };
  } catch {
    return { configured: true, verified: false, code: "unavailable" as const };
  }
}

export function googleAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}
