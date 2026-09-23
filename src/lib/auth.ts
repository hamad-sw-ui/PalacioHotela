import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Sessions are carried three ways so sign-in works everywhere the site can be displayed:
 *  1. `palacio_session`   – first-party cookie (SameSite=Lax), for a normal browser tab.
 *  2. `palacio_session_x` – SameSite=None; Secure; Partitioned cookie, accepted by browsers
 *     when the site is embedded in another site's iframe (e.g. a builder preview pane).
 *  3. `Authorization: Bearer <token>` – returned at sign-in and kept by the page itself,
 *     for browsers that refuse every embedded cookie (Safari, strict privacy settings).
 * All three hold the same HMAC-signed token.
 */
const COOKIE = "palacio_session";
const EMBED_COOKIE = "palacio_session_x";
const MAX_AGE = 7 * 86400;
const signingKey = () => process.env.SESSION_SECRET || process.env.DATABASE_URL || "palacio-local-session-key";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  try {
    const computed = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return expected.length === computed.length && timingSafeEqual(expected, computed);
  } catch { return false; }
}

function sign(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export function createSessionToken(userId: number) {
  const payload = Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string | null | undefined) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { id: unknown; exp: unknown };
    if (!Number.isInteger(parsed.id) || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed.id as number;
  } catch { return null; }
}

/** Opens a session and returns the token, which the client also keeps for the bearer fallback. */
export async function setSession(userId: number) {
  const token = createSessionToken(userId);
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
  jar.set(EMBED_COOKIE, token, { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: MAX_AGE });
  return token;
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  // A partitioned cookie is only removed when the deletion repeats the same attributes.
  jar.set(EMBED_COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: 0 });
}

async function bearerToken() {
  const authorization = (await headers()).get("authorization") || "";
  return /^bearer\s+/i.test(authorization) ? authorization.replace(/^bearer\s+/i, "").trim() : null;
}

export async function getCurrentUser() {
  const bearer = await bearerToken();
  const jar = await cookies();
  // An explicit bearer token takes precedence; otherwise either session cookie is accepted.
  const candidates = bearer ? [bearer] : [jar.get(COOKIE)?.value, jar.get(EMBED_COOKIE)?.value];
  for (const token of candidates) {
    const id = readSessionToken(token);
    if (!id) continue;
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (user?.active) return user;
  }
  return null;
}

export async function getAdmin() {
  const user = await getCurrentUser();
  return user && (user.role === "admin" || user.role === "staff") ? user : null;
}

/**
 * CSRF protection for state-changing admin requests. Because one session cookie is
 * SameSite=None, a cookie-only request must provably come from this site's own pages.
 * Bearer-token requests are safe by construction: another site cannot read the token
 * nor attach an Authorization header without a CORS pre-flight, which is never granted.
 */
async function isTrustedMutation() {
  const h = await headers();
  if (/^bearer\s+/i.test(h.get("authorization") || "")) return true;
  const fetchSite = h.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  const origin = h.get("origin");
  if (!origin) return true; // Non-browser client (scripts, server-to-server).
  try { return new URL(origin).host === (h.get("x-forwarded-host") || h.get("host")); } catch { return false; }
}

export async function getAdminForMutation() {
  const admin = await getAdmin();
  return admin && await isTrustedMutation() ? admin : null;
}
