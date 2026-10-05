import assert from "node:assert/strict";
import test from "node:test";
import { decideGoogleAccount, fetchGoogleIdentity, googleAuthConfigured, googleCredentials, googleEnvFromSettings, googleAuthorizeUrl, googleIdentityFromProfile, googleLinkUpdate, googleNewUser, googleRedirectUri, isValidGoogleClientId, probeGoogle, readGoogleState, signGoogleState } from "../src/lib/google-auth";
import { settingsForBrowser } from "../src/lib/smtp";

const googleClientId = "123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com";

test("an empty stored id keeps the server variables untouched", () => {
  const env = { GOOGLE_CLIENT_ID: "env-id", GOOGLE_CLIENT_SECRET: "env-secret" };
  assert.deepEqual(googleEnvFromSettings(null, env), env);
  assert.deepEqual(googleEnvFromSettings(undefined, env), env);
  assert.deepEqual(googleEnvFromSettings({ googleClientId: "", googleClientSecret: "ignored" }, env), env);
  assert.deepEqual(googleEnvFromSettings({ googleClientId: "   ", googleClientSecret: "" }, env), env);
});

test("a stored id replaces the server variables and trims once", () => {
  const env = { GOOGLE_CLIENT_ID: "987654321098-environment.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "env-secret" };
  assert.deepEqual(googleEnvFromSettings({ googleClientId: `  ${googleClientId}  `, googleClientSecret: "db-secret" }, env), {
    GOOGLE_CLIENT_ID: googleClientId,
    GOOGLE_CLIENT_SECRET: "db-secret",
  });
});

test("client IDs must be raw Google OAuth IDs, not URLs", () => {
  assert.equal(isValidGoogleClientId(` ${googleClientId} `), true);
  assert.equal(isValidGoogleClientId(`http://${googleClientId}/`), false);
  assert.equal(isValidGoogleClientId(`https://${googleClientId}`), false);
  assert.equal(isValidGoogleClientId("not-a-google-client-id"), false);
});

test("configuration is trimmed before deciding it is usable", () => {
  assert.equal(googleAuthConfigured({ GOOGLE_CLIENT_ID: ` ${googleClientId} `, GOOGLE_CLIENT_SECRET: " secret " }), true);
  assert.equal(googleAuthConfigured({ GOOGLE_CLIENT_ID: "   ", GOOGLE_CLIENT_SECRET: "secret" }), false);
  assert.equal(googleAuthConfigured({ GOOGLE_CLIENT_ID: `http://${googleClientId}/`, GOOGLE_CLIENT_SECRET: "secret" }), false);
  assert.equal(googleAuthConfigured({ GOOGLE_CLIENT_ID: googleClientId }), false);
  assert.equal(googleAuthConfigured({}), false);
});

test("credentials only resolve when both parts are present and trimmed", () => {
  assert.deepEqual(googleCredentials({ GOOGLE_CLIENT_ID: ` ${googleClientId} `, GOOGLE_CLIENT_SECRET: " secret " }), { clientId: googleClientId, clientSecret: "secret" });
  assert.equal(googleCredentials({ GOOGLE_CLIENT_ID: `http://${googleClientId}/`, GOOGLE_CLIENT_SECRET: "secret" }), null);
  assert.equal(googleCredentials({ GOOGLE_CLIENT_ID: googleClientId, GOOGLE_CLIENT_SECRET: "  " }), null);
  assert.equal(googleCredentials({}), null);
});

test("the browser never receives the Google secret", () => {
  const stored = { hotelName: "Palacio", googleClientId: "db-id", googleClientSecret: "super-secret" };
  const visible = settingsForBrowser(stored);
  assert.equal(visible.googleClientSecret, "");
  assert.equal(visible.googleClientId, "db-id", "the client id stays readable to copy into Google");
  assert.equal(JSON.stringify(visible).includes("super-secret"), false);
});

test("a settings object without Google keys is returned as is", () => {
  const plain = { hotelName: "Palacio" };
  assert.deepEqual(settingsForBrowser(plain), plain);
});

test("the probe reports missing credentials without calling Google", async () => {
  let called = false;
  const fetchImpl = (async () => { called = true; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  const result = await probeGoogle({ settings: { googleClientId: "", googleClientSecret: "" }, env: {}, fetchImpl });
  assert.equal(result.configured, false);
  assert.equal(result.verified, false);
  assert.equal(result.code, "missing");
  assert.equal(called, false, "no request is sent when nothing is configured");

  const noSecret = await probeGoogle({ settings: { googleClientId, googleClientSecret: "" }, env: {}, fetchImpl });
  assert.equal(noSecret.code, "missing");
  assert.equal(called, false, "no request is sent without a secret");
});

test("the probe never echoes the secret on success or failure", async () => {
  const ok = await probeGoogle({
    settings: { googleClientId, googleClientSecret: "super-secret" },
    env: {},
    fetchImpl: (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch,
  });
  assert.equal(ok.verified, true);
  assert.equal(JSON.stringify(ok).includes("super-secret"), false);

  const failed = await probeGoogle({
    settings: { googleClientId, googleClientSecret: "super-secret" },
    env: {},
    fetchImpl: (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch,
  });
  assert.equal(failed.verified, false);
  assert.equal(failed.code, "unavailable");
  assert.equal(JSON.stringify(failed).includes("super-secret"), false);
});

test("the probe asks Google to authenticate the pair, since tokeninfo ignores credentials", async () => {
  let requested = "";
  const capture = async (url: unknown, init: { body: unknown }) => {
    requested = String(url) + " " + new URLSearchParams(String(init.body)).get("grant_type");
    return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
  };
  const result = await probeGoogle({
    settings: { googleClientId, googleClientSecret: "super-secret" },
    env: {},
    fetchImpl: capture as unknown as typeof fetch,
  });
  assert.equal(requested, "https://oauth2.googleapis.com/token authorization_code");
  assert.equal(result.verified, true, "Google rejected only the throwaway code, so the pair is valid");
  assert.equal(JSON.stringify(result).includes("super-secret"), false);
});

test("the probe distinguishes rejected credentials from upstream failures", async () => {
  for (const error of ["invalid_client", "unauthorized_client"]) {
    const result = await probeGoogle({
      settings: { googleClientId, googleClientSecret: "super-secret" },
      env: {},
      fetchImpl: (async () => new Response(JSON.stringify({ error }), { status: 401 })) as unknown as typeof fetch,
    });
    assert.equal(result.code, "invalid_credentials", `${error} must be reported as a rejected pair`);
  }
  const unreachable = await probeGoogle({
    settings: { googleClientId, googleClientSecret: "super-secret" },
    env: {},
    fetchImpl: (async () => { throw new Error("offline"); }) as unknown as typeof fetch,
  });
  assert.equal(unreachable.code, "unavailable", "an unanswered probe must not claim the pair is valid");

  const upstreamFailure = await probeGoogle({
    settings: { googleClientId, googleClientSecret: "super-secret" },
    env: {},
    fetchImpl: (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch,
  });
  assert.equal(upstreamFailure.code, "unavailable");

  const invalidId = await probeGoogle({
    settings: { googleClientId: `http://${googleClientId}/`, googleClientSecret: "super-secret" },
    env: {},
    fetchImpl: (async () => { throw new Error("must not be called"); }) as unknown as typeof fetch,
  });
  assert.equal(invalidId.code, "invalid_id");
});

test("the redirect URI uses one canonical callback and rejects unsafe overrides", () => {
  assert.equal(googleRedirectUri("http://localhost:3000", ""), "http://localhost:3000/api/auth/google/callback");
  assert.equal(googleRedirectUri("http://internal:3000", "https://hotel.example.com/api/auth/google/callback"), "https://hotel.example.com/api/auth/google/callback");
  assert.equal(googleRedirectUri("http://localhost:3000", "http://hotel.example.com/api/auth/google/callback"), null);
  assert.equal(googleRedirectUri("http://localhost:3000", "https://hotel.example.com/other"), null);
  assert.equal(googleRedirectUri("http://localhost:3000", "https://hotel.example.com/api/auth/google/callback?next=/admin"), null);
});

test("OAuth state is signed, expires, and keeps only a safe return path", () => {
  const token = signGoogleState({ next: "/compte", locale: "en" }, "state-secret", 1000);
  assert.deepEqual(readGoogleState(token, "state-secret", 1001), { next: "/compte", locale: "en" });
  assert.equal(readGoogleState(token, "wrong-secret", 1001), null);
  assert.equal(readGoogleState(`${token}tampered`, "state-secret", 1001), null);
  assert.equal(readGoogleState(token, "state-secret", 601001), null);
});

test("Google profile and account decisions preserve account boundaries", () => {
  const identity = googleIdentityFromProfile({ sub: "google-sub", email: "CLIENT@example.com", email_verified: true, name: "Client" });
  assert.deepEqual(identity, { sub: "google-sub", email: "client@example.com", emailVerified: true, name: "Client" });
  assert.equal(googleIdentityFromProfile({ email: "client@example.com" }), null);
  assert.equal(decideGoogleAccount({ ...identity!, emailVerified: false }, null, null).action, "refuse");

  const existing = { id: 7, email: "client@example.com", googleSub: null, active: true, role: "guest", passwordHash: "unchanged" };
  const linkDecision = decideGoogleAccount(identity!, null, existing);
  assert.deepEqual(linkDecision, { action: "sign-in", userId: 7, linkSub: true });
  assert.deepEqual(googleLinkUpdate(linkDecision, "google-sub"), { googleSub: "google-sub" });
  assert.deepEqual(googleLinkUpdate({ action: "sign-in", userId: 7, linkSub: false }, "google-sub"), null);
  assert.equal(decideGoogleAccount(identity!, null, { ...existing, googleSub: "other-sub" }).action, "refuse");
  assert.equal(decideGoogleAccount(identity!, null, { ...existing, active: false }).action, "refuse");
  assert.deepEqual(decideGoogleAccount(identity!, null, null), { action: "create" });
  assert.equal(googleNewUser(identity!, "fr").role, "guest");
  assert.equal(googleNewUser(identity!, "fr").passwordHash, null);
});

test("the OAuth code exchange verifies the returned profile", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (url: unknown) => {
    calls.push(String(url));
    if (String(url) === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "access-token" }));
    return new Response(JSON.stringify({ sub: "google-sub", email: "client@example.com", email_verified: true, name: "Client" }));
  }) as unknown as typeof fetch;
  const result = await fetchGoogleIdentity({ code: "authorization-code", clientId: googleClientId, clientSecret: "secret", redirectUri: "https://hotel.example.com/api/auth/google/callback", fetchImpl });
  assert.deepEqual(calls, ["https://oauth2.googleapis.com/token", "https://openidconnect.googleapis.com/v1/userinfo"]);
  assert.deepEqual(result, { ok: true, identity: { sub: "google-sub", email: "client@example.com", emailVerified: true, name: "Client" } });

  const unverified = await fetchGoogleIdentity({
    code: "authorization-code",
    clientId: googleClientId,
    clientSecret: "secret",
    redirectUri: "https://hotel.example.com/api/auth/google/callback",
    fetchImpl: (async (url: unknown) => String(url) === "https://oauth2.googleapis.com/token"
      ? new Response(JSON.stringify({ access_token: "access-token" }))
      : new Response(JSON.stringify({ sub: "google-sub", email: "client@example.com", email_verified: false }))) as unknown as typeof fetch,
  });
  assert.deepEqual(unverified, { ok: false, reason: "unverified" });
});

test("the authorize URL keeps the scope, the redirect and the signed state", () => {
  const url = new URL(googleAuthorizeUrl({ clientId: googleClientId, redirectUri: "https://hotel.test/api/auth/google/callback", state: "signed-state" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), googleClientId);
  assert.equal(url.searchParams.get("redirect_uri"), "https://hotel.test/api/auth/google/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("state"), "signed-state");
});