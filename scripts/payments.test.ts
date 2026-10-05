import assert from "node:assert/strict";
import { test } from "node:test";
import { OFFICIAL_XAF_PER_EUR, paymentConfiguration, probePaypal, probeStripe, redactPaypalError, redactStripeError, resolvePaypalConfig, resolveStripeConfig, resolveXafPerEur, stripeChargeFromXaf, stripeSessionMatchesBooking } from "@/lib/payments";

const env = { STRIPE_SECRET_KEY: "sk_test_env", STRIPE_WEBHOOK_SECRET: "whsec_env" };

test("platform Stripe keys replace the server variables, empty values keep the fallback", () => {
  assert.deepEqual(resolveStripeConfig({ stripeSecretKey: "sk_live_page", stripeWebhookSecret: "whsec_page" }, env), {
    secretKey: "sk_live_page",
    webhookSecret: "whsec_page",
  });
  assert.deepEqual(resolveStripeConfig({ stripeSecretKey: "  ", stripeWebhookSecret: "" }, env), {
    secretKey: "sk_test_env",
    webhookSecret: "whsec_env",
  });
  assert.deepEqual(resolveStripeConfig(null, env), { secretKey: "sk_test_env", webhookSecret: "whsec_env" });
  assert.deepEqual(resolveStripeConfig({ stripeSecretKey: "sk_live_page", stripeWebhookSecret: "" }, env), {
    secretKey: "sk_live_page",
    webhookSecret: "whsec_env",
  });
});

test("card payments stay off until both the secret key and the webhook secret are resolved", () => {
  const previous = { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET, PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET, PAYPAL_XAF_PER_EUR: process.env.PAYPAL_XAF_PER_EUR };
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_XAF_PER_EUR;
  try {
    assert.equal(paymentConfiguration({ stripeSecretKey: "sk_live_page", stripeWebhookSecret: "whsec_page" }).card, true);
    assert.equal(paymentConfiguration({ stripeSecretKey: "sk_live_page", stripeWebhookSecret: "" }).card, false);
    assert.equal(paymentConfiguration({ stripeSecretKey: "", stripeWebhookSecret: "" }).card, false);
    assert.equal(paymentConfiguration({ stripeSecretKey: "", stripeWebhookSecret: "" }).cash, true);
    assert.equal(paymentConfiguration({ stripeSecretKey: "", stripeWebhookSecret: "" }).paypal, false);
  } finally {
    if (previous.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = previous.STRIPE_SECRET_KEY; else delete process.env.STRIPE_SECRET_KEY;
    if (previous.STRIPE_WEBHOOK_SECRET) process.env.STRIPE_WEBHOOK_SECRET = previous.STRIPE_WEBHOOK_SECRET; else delete process.env.STRIPE_WEBHOOK_SECRET;
    if (previous.PAYPAL_CLIENT_ID) process.env.PAYPAL_CLIENT_ID = previous.PAYPAL_CLIENT_ID; else delete process.env.PAYPAL_CLIENT_ID;
    if (previous.PAYPAL_CLIENT_SECRET) process.env.PAYPAL_CLIENT_SECRET = previous.PAYPAL_CLIENT_SECRET; else delete process.env.PAYPAL_CLIENT_SECRET;
    if (previous.PAYPAL_XAF_PER_EUR) process.env.PAYPAL_XAF_PER_EUR = previous.PAYPAL_XAF_PER_EUR; else delete process.env.PAYPAL_XAF_PER_EUR;
  }
});

test("Stripe charges EUR from XAF at the official CFA peg, and a paid session must match the stored charge", () => {
  assert.equal(resolveXafPerEur({}), OFFICIAL_XAF_PER_EUR);
  assert.equal(resolveXafPerEur({ PAYPAL_XAF_PER_EUR: "650" }), 650);
  assert.equal(resolveXafPerEur({ STRIPE_XAF_PER_EUR: "660", PAYPAL_XAF_PER_EUR: "650" }), 660);
  assert.deepEqual(stripeChargeFromXaf(655957, OFFICIAL_XAF_PER_EUR), { amount: 100000, currency: "eur", displayValue: "1000.00", rate: OFFICIAL_XAF_PER_EUR });
  const deluxe = stripeChargeFromXaf(95000, OFFICIAL_XAF_PER_EUR);
  assert.equal(deluxe.currency, "eur");
  assert.equal(deluxe.amount, Math.round((95000 / OFFICIAL_XAF_PER_EUR) * 100));
  const booking = { id: 12, paymentMethod: "card", paymentRef: "cs_test_1", paymentAmount: deluxe.amount, paymentCurrency: "EUR", total: 95000 };
  assert.equal(stripeSessionMatchesBooking({ id: "cs_test_1", payment_status: "paid", amount_total: deluxe.amount, currency: "eur", metadata: { bookingId: "12" } }, booking), true);
  assert.equal(stripeSessionMatchesBooking({ id: "cs_test_1", payment_status: "paid", amount_total: 95000, currency: "xaf", metadata: { bookingId: "12" } }, booking), false);
  assert.equal(stripeSessionMatchesBooking({ id: "cs_test_1", payment_status: "paid", amount_total: 95000, currency: "xaf", metadata: { bookingId: "9" } }, { id: 9, paymentMethod: "card", paymentRef: "cs_test_1", paymentAmount: null, paymentCurrency: "XAF", total: 95000 }), true);
});

test("platform PayPal credentials replace the server variables and empty values keep the fallback", () => {
  const env = { PAYPAL_CLIENT_ID: "env-id", PAYPAL_CLIENT_SECRET: "env-secret", PAYPAL_ENV: "live", PAYPAL_XAF_PER_EUR: "650" };
  assert.deepEqual(resolvePaypalConfig({ paypalClientId: "page-id", paypalClientSecret: "page-secret", paypalEnv: "sandbox", paypalXafPerEur: 655.957 }, env), {
    clientId: "page-id",
    clientSecret: "page-secret",
    envMode: "sandbox",
    rate: 655.957,
  });
  assert.deepEqual(resolvePaypalConfig({ paypalClientId: "  ", paypalClientSecret: "", paypalEnv: "", paypalXafPerEur: 0 }, env), {
    clientId: "env-id",
    clientSecret: "env-secret",
    envMode: "live",
    rate: 650,
  });
  assert.equal(paymentConfiguration({ paypalClientId: "page-id", paypalClientSecret: "page-secret" }).paypal, true);
  assert.equal(resolvePaypalConfig({ paypalClientId: "page-id", paypalClientSecret: "" }, {}).clientSecret, "");
});

test("a PayPal probe never returns the secret", async () => {
  const calls: string[] = [];
  const verified = await probePaypal({
    settings: { paypalClientId: "page-id", paypalClientSecret: "page-secret", paypalEnv: "sandbox" },
    env: {},
    fetchImpl: (async (url) => { calls.push(String(url)); return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 }); }) as typeof fetch,
  });
  assert.equal(verified.code, "verified");
  assert.equal(verified.envMode, "sandbox");
  assert.match(calls[0] || "", /api-m.sandbox.paypal.com/);
  assert.equal(JSON.stringify(verified).includes("page-secret"), false);
  assert.equal((await probePaypal({ settings: {}, env: {}, fetchImpl: async () => { throw new Error("should not connect"); } })).code, "missing");
  const failed = await probePaypal({
    settings: { paypalClientId: "page-id", paypalClientSecret: "page-secret" },
    env: {},
    fetchImpl: (async () => { throw new Error("auth page-secret refused"); }) as typeof fetch,
  });
  assert.equal(failed.code, "failed");
  assert.equal(failed.error?.includes("page-secret"), false);
  assert.match(redactPaypalError(new Error("auth page-secret refused"), ["page-secret"]), /••••/);
});

test("a Stripe probe never returns the secret and can confirm the key without the webhook", async () => {
  const keys: string[] = [];
  const verified = await probeStripe({
    settings: { stripeSecretKey: "sk_test_page", stripeWebhookSecret: "whsec_page" },
    env: {},
    retrieve: async (key) => { keys.push(key); return { id: "acct_1", livemode: false }; },
  });
  assert.equal(verified.code, "verified");
  assert.equal(verified.verified, true);
  assert.deepEqual(keys, ["sk_test_page"]);
  assert.equal(JSON.stringify(verified).includes("sk_test_page"), false);
  assert.equal(JSON.stringify(verified).includes("whsec_page"), false);

  const keyOnly = await probeStripe({
    settings: { stripeSecretKey: "sk_test_page", stripeWebhookSecret: "" },
    env: {},
    retrieve: async () => ({ id: "acct_1" }),
  });
  assert.equal(keyOnly.code, "key_only");
  assert.equal(keyOnly.verified, true);
  assert.equal(keyOnly.webhookReady, false);

  const missing = await probeStripe({ settings: {}, env: {}, retrieve: async () => { throw new Error("should not connect"); } });
  assert.equal(missing.code, "missing");

  const failed = await probeStripe({
    settings: { stripeSecretKey: "sk_test_page", stripeWebhookSecret: "whsec_page" },
    env: {},
    retrieve: async () => { throw new Error("Invalid API Key: sk_test_page"); },
  });
  assert.equal(failed.code, "failed");
  assert.equal(failed.error?.includes("sk_test_page"), false);
  assert.match(redactStripeError(new Error("auth sk_test_page refused"), ["sk_test_page"]), /••••/);
});
