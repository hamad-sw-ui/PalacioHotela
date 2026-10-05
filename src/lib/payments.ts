import Stripe from "stripe";
import type { Booking } from "@/db/schema";
import { formatXaf } from "@/lib/format";

/** Official CFA franc peg: 1 EUR = 655.957 XAF. Used when Stripe cannot present XAF. */
export const OFFICIAL_XAF_PER_EUR = 655.957;

type EnvBag = Record<string, string | undefined>;

export function resolveXafPerEur(env: EnvBag = process.env, settings?: { paypalXafPerEur?: number | string | null } | null) {
  const fromSettings = Number(settings?.paypalXafPerEur || 0);
  if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
  const stripe = Number(env.STRIPE_XAF_PER_EUR || "");
  if (Number.isFinite(stripe) && stripe > 0) return stripe;
  const paypal = Number(env.PAYPAL_XAF_PER_EUR || "");
  if (Number.isFinite(paypal) && paypal > 0) return paypal;
  return OFFICIAL_XAF_PER_EUR;
}

export function stripeChargeFromXaf(totalXaf: number, rate = resolveXafPerEur()) {
  if (!Number.isFinite(totalXaf) || totalXaf <= 0) throw new Error("Stripe amount is invalid");
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Stripe XAF/EUR rate is not configured");
  const cents = Math.max(1, Math.round((totalXaf / rate) * 100));
  return { amount: cents, currency: "eur" as const, displayValue: (cents / 100).toFixed(2), rate };
}

export function stripeSessionMatchesBooking(
  session: { id?: string | null; payment_status?: string | null; amount_total?: number | null; currency?: string | null; metadata?: Record<string, string> | null },
  booking: { id: number; paymentMethod: string | null; paymentRef: string | null; paymentAmount: number | null; paymentCurrency: string | null; total: number },
) {
  if (booking.paymentMethod !== "card" || !session.id || booking.paymentRef !== session.id || session.payment_status !== "paid") return false;
  if (String(session.metadata?.bookingId || "") !== String(booking.id)) return false;
  const currency = (booking.paymentCurrency || "xaf").toLowerCase();
  const expected = booking.paymentAmount == null && currency === "xaf" ? booking.total : booking.paymentAmount;
  return session.amount_total === expected && session.currency === currency;
}

export type StripeSettings = {
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
};

export type PaypalSettings = {
  paypalClientId?: string | null;
  paypalClientSecret?: string | null;
  paypalEnv?: string | null;
  paypalXafPerEur?: number | string | null;
};

export type PaymentSettings = StripeSettings & PaypalSettings;

export function resolvePaypalConfig(settings?: PaypalSettings | null, env: EnvBag = process.env) {
  const saved = (settings?.paypalEnv || "").trim();
  return {
    clientId: (settings?.paypalClientId || "").trim() || env.PAYPAL_CLIENT_ID || "",
    clientSecret: (settings?.paypalClientSecret || "").trim() || env.PAYPAL_CLIENT_SECRET || "",
    envMode: saved === "live" || saved === "sandbox" ? saved : env.PAYPAL_ENV === "live" ? "live" : "sandbox",
    rate: resolveXafPerEur(env, settings),
  };
}

export function paypalBase(envMode = "sandbox") {
  return envMode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export type StripeEnv = EnvBag;

export function resolveStripeConfig(settings?: StripeSettings | null, env: StripeEnv = process.env) {
  return {
    secretKey: (settings?.stripeSecretKey || "").trim() || env.STRIPE_SECRET_KEY || "",
    webhookSecret: (settings?.stripeWebhookSecret || "").trim() || env.STRIPE_WEBHOOK_SECRET || "",
  };
}

export function paymentConfiguration(settings?: PaymentSettings | null) {
  const stripe = resolveStripeConfig(settings);
  const paypal = resolvePaypalConfig(settings);
  return { card: Boolean(stripe.secretKey && stripe.webhookSecret), paypal: Boolean(paypal.clientId && paypal.clientSecret && paypal.rate > 0), cash: true, paypalRate: paypal.rate > 0 ? paypal.rate : null, stripeRate: resolveXafPerEur(process.env, settings) };
}

export function stripeClient(secretKey = "") {
  const key = secretKey || process.env.STRIPE_SECRET_KEY || "";
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key);
}

export function redactStripeError(value: unknown, secrets: string[] = []) {
  const message = value instanceof Error ? value.message : String(value || "Connexion Stripe impossible.");
  return secrets.filter(Boolean).reduce((text, secret) => text.split(secret).join("••••"), message).replace(/\b(sk|pk|rk|whsec)_[A-Za-z0-9]+/g, "••••").replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function probeStripe(input: { settings?: StripeSettings | null; env?: StripeEnv; retrieve?: (key: string) => Promise<{ id?: string; livemode?: boolean }> } = {}) {
  const stripe = resolveStripeConfig(input.settings, input.env ?? process.env);
  if (!stripe.secretKey) return { configured: false, verified: false, webhookReady: Boolean(stripe.webhookSecret), code: "missing" as const };
  try {
    const retrieve = input.retrieve || ((key: string) => stripeClient(key).balance.retrieve());
    await retrieve(stripe.secretKey);
    return { configured: true, verified: true, webhookReady: Boolean(stripe.webhookSecret), code: stripe.webhookSecret ? "verified" as const : "key_only" as const };
  } catch (error) {
    return { configured: true, verified: false, webhookReady: Boolean(stripe.webhookSecret), code: "failed" as const, error: redactStripeError(error, [stripe.secretKey, stripe.webhookSecret]) };
  }
}

export async function createStripeCheckout(booking: Booking, origin: string) {
  const { getSettings } = await import("@/lib/hotel");
  const settings = await getSettings();
  const stripe = stripeClient(resolveStripeConfig(settings).secretKey);
  const charge = stripeChargeFromXaf(booking.total, resolveXafPerEur(process.env, settings));
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"], customer_email: booking.guestEmail,
    line_items: [{ price_data: { currency: charge.currency, unit_amount: charge.amount, product_data: { name: `${booking.itemName} · ${booking.reference}`, description: `${booking.checkIn} → ${booking.checkOut} · ${formatXaf(booking.total)}` } }, quantity: 1 }],
    success_url: `${origin}/reservation/confirmation?token=${booking.publicToken}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/reservation/confirmation?token=${booking.publicToken}&cancelled=1`,
    metadata: { bookingId: String(booking.id), reference: booking.reference || "", amountXaf: String(booking.total) },
  }, { idempotencyKey: `palacio-booking-${booking.id}-${charge.currency}-${charge.amount}` });
  if (!session.url) throw new Error("Stripe did not return a payment URL");
  return { url: session.url, reference: session.id, amount: charge.amount, currency: "EUR", displayValue: charge.displayValue };
}

export function redactPaypalError(value: unknown, secrets: string[] = []) {
  const message = value instanceof Error ? value.message : String(value || "Connexion PayPal impossible.");
  return secrets.filter(Boolean).reduce((text, secret) => text.split(secret).join("••••"), message).replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function probePaypal(input: { settings?: PaypalSettings | null; env?: EnvBag; fetchImpl?: typeof fetch } = {}) {
  const paypal = resolvePaypalConfig(input.settings, input.env ?? process.env);
  if (!paypal.clientId || !paypal.clientSecret) return { configured: false, verified: false, code: "missing" as const, envMode: paypal.envMode, rate: paypal.rate };
  try {
    const fetchImpl = input.fetchImpl || fetch;
    const credentials = Buffer.from(`${paypal.clientId}:${paypal.clientSecret}`).toString("base64");
    const response = await fetchImpl(`${paypalBase(paypal.envMode)}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
    if (!response.ok) throw new Error((await response.text().catch(() => "")) || "PayPal authentication failed");
    return { configured: true, verified: true, code: "verified" as const, envMode: paypal.envMode, rate: paypal.rate };
  } catch (error) {
    return { configured: true, verified: false, code: "failed" as const, envMode: paypal.envMode, rate: paypal.rate, error: redactPaypalError(error, [paypal.clientId, paypal.clientSecret]) };
  }
}

async function paypalToken(config: ReturnType<typeof resolvePaypalConfig>) {
  if (!config.clientId || !config.clientSecret) throw new Error("PayPal is not configured");
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${paypalBase(config.envMode)}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
  if (!response.ok) throw new Error("PayPal authentication failed");
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

export async function createPayPalOrder(booking: Booking, origin: string) {
  const { getSettings } = await import("@/lib/hotel");
  const paypal = resolvePaypalConfig(await getSettings());
  if (!paypal.rate || !Number.isFinite(paypal.rate)) throw new Error("PayPal XAF/EUR conversion rate is not configured");
  const value = (booking.total / paypal.rate).toFixed(2);
  const token = await paypalToken(paypal);
  const response = await fetch(`${paypalBase(paypal.envMode)}/v2/checkout/orders`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `palacio-${booking.id}` },
    body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: booking.reference, description: `${booking.itemName} · ${formatXaf(booking.total)}`, amount: { currency_code: "EUR", value } }], payment_source: { paypal: { experience_context: { brand_name: "Palacio Hotel", locale: booking.locale === "en" ? "en-US" : "fr-FR", user_action: "PAY_NOW", return_url: `${origin}/api/payments/paypal/return?booking=${booking.publicToken}`, cancel_url: `${origin}/reservation/confirmation?token=${booking.publicToken}&cancelled=1` } } } }),
    cache: "no-store",
  });
  const data = await response.json() as { id?: string; links?: { rel: string; href: string }[]; message?: string };
  if (!response.ok || !data.id) throw new Error(data.message || "PayPal order creation failed");
  const url = data.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  if (!url) throw new Error("PayPal did not return an approval URL");
  return { url, reference: data.id, amount: Math.round(Number(value) * 100), currency: "EUR", displayValue: value };
}

export type RefundResult = { ok: true; refundRef: string } | { ok: false; error: string };

const refundErrorText = (error: unknown) => {
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : error instanceof Error ? error.message : "Remboursement impossible.";
  return message.replace(/\s+/g, " ").trim().slice(0, 300) || "Remboursement impossible.";
};

const stripeErrorCode = (error: unknown) => error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";

function paymentIntentId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return "";
}

export async function refundStripeCheckoutSession(sessionId: string, idempotencyKey: string, deps: {
  retrieveSession: (sessionId: string) => Promise<{ payment_status?: string | null; payment_intent?: unknown }>;
  createRefund: (paymentIntentId: string, idempotencyKey: string) => Promise<{ id?: string | null; status?: string | null }>;
}): Promise<RefundResult> {
  if (!sessionId) return { ok: false, error: "Référence de paiement Stripe absente." };
  let session: { payment_status?: string | null; payment_intent?: unknown };
  try { session = await deps.retrieveSession(sessionId); } catch (error) { return { ok: false, error: refundErrorText(error) }; }
  const intentId = paymentIntentId(session.payment_intent);
  if (!intentId || session.payment_status !== "paid") return { ok: false, error: "Paiement Stripe introuvable pour cette réservation." };
  try {
    const refund = await deps.createRefund(intentId, idempotencyKey);
    if (!refund.id || (refund.status && !["succeeded", "pending"].includes(refund.status))) return { ok: false, error: "Stripe n’a pas confirmé le remboursement." };
    return { ok: true, refundRef: refund.id };
  } catch (error) {
    if (stripeErrorCode(error) === "charge_already_refunded") return { ok: true, refundRef: intentId };
    return { ok: false, error: refundErrorText(error) };
  }
}

type PayPalCapture = { id?: string; status?: string; amount?: { value?: string; currency_code?: string } };
type PayPalOrderBody = { purchase_units?: { payments?: { captures?: PayPalCapture[]; refunds?: { id?: string; status?: string }[] } }[] };

export async function refundPayPalOrderPayment(input: { orderId: string; expectedCents: number; idempotencyKey: string; token: string; baseUrl: string; fetchImpl?: typeof fetch }): Promise<RefundResult> {
  if (!input.orderId || !input.expectedCents) return { ok: false, error: "Référence de paiement PayPal absente." };
  const fetchImpl = input.fetchImpl || fetch;
  const headers = { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json" };
  let order: PayPalOrderBody;
  try {
    const response = await fetchImpl(`${input.baseUrl}/v2/checkout/orders/${encodeURIComponent(input.orderId)}`, { headers, cache: "no-store" });
    if (!response.ok) return { ok: false, error: "Commande PayPal introuvable." };
    order = await response.json() as PayPalOrderBody;
  } catch (error) { return { ok: false, error: refundErrorText(error) }; }
  const payments = order.purchase_units?.[0]?.payments;
  const capture = payments?.captures?.[0];
  if (!capture?.id) return { ok: false, error: "Capture PayPal introuvable." };
  const cents = Math.round(Number(capture.amount?.value) * 100);
  if (capture.amount?.currency_code !== "EUR" || cents !== input.expectedCents) return { ok: false, error: "Le montant PayPal ne correspond pas au paiement enregistré." };
  if (capture.status === "REFUNDED") return { ok: true, refundRef: payments?.refunds?.[0]?.id || capture.id };
  if (capture.status !== "COMPLETED" && capture.status !== "PARTIALLY_REFUNDED") return { ok: false, error: "La capture PayPal ne peut pas être remboursée." };
  try {
    const response = await fetchImpl(`${input.baseUrl}/v2/payments/captures/${encodeURIComponent(capture.id)}/refund`, { method: "POST", headers: { ...headers, "PayPal-Request-Id": input.idempotencyKey }, body: "{}", cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { id?: string; status?: string; message?: string };
    if (!response.ok || !data.id || (data.status && !["COMPLETED", "PENDING"].includes(data.status))) return { ok: false, error: (data.message || "PayPal n’a pas confirmé le remboursement.").slice(0, 300) };
    return { ok: true, refundRef: data.id };
  } catch (error) { return { ok: false, error: refundErrorText(error) }; }
}

export async function refundCollectedCharge(booking: Pick<Booking, "id" | "paymentMethod" | "paymentRef" | "paymentAmount">): Promise<RefundResult> {
  const { getSettings } = await import("@/lib/hotel");
  const settings = await getSettings();
  const idempotencyKey = `palacio-refund-${booking.id}`;
  if (booking.paymentMethod === "card") {
    const stripeConfig = resolveStripeConfig(settings);
    if (!stripeConfig.secretKey || !booking.paymentRef) return { ok: false, error: "Stripe n’est pas configuré pour ce remboursement." };
    const stripe = stripeClient(stripeConfig.secretKey);
    return refundStripeCheckoutSession(booking.paymentRef, idempotencyKey, {
      retrieveSession: (sessionId) => stripe.checkout.sessions.retrieve(sessionId),
      createRefund: (intentId, key) => stripe.refunds.create({ payment_intent: intentId }, { idempotencyKey: key }),
    });
  }
  if (booking.paymentMethod === "paypal") {
    const paypal = resolvePaypalConfig(settings);
    if (!paypal.clientId || !paypal.clientSecret || !booking.paymentRef || !booking.paymentAmount) return { ok: false, error: "PayPal n’est pas configuré pour ce remboursement." };
    const token = await paypalToken(paypal);
    return refundPayPalOrderPayment({ orderId: booking.paymentRef, expectedCents: booking.paymentAmount, idempotencyKey, token, baseUrl: paypalBase(paypal.envMode) });
  }
  return { ok: false, error: "Ce mode de paiement ne se rembourse pas en ligne." };
}

export async function cardCheckoutCollected(sessionId: string | null | undefined) {
  if (!sessionId) return false;
  const { getSettings } = await import("@/lib/hotel");
  const stripeConfig = resolveStripeConfig(await getSettings());
  if (!stripeConfig.secretKey) return false;
  try {
    const session = await stripeClient(stripeConfig.secretKey).checkout.sessions.retrieve(sessionId);
    return session.payment_status === "paid";
  } catch (error) { console.error("[Palacio] Stripe session lookup:", error); return false; }
}

export async function expireOpenStripeSession(sessionId: string | null | undefined) {
  if (!sessionId) return;
  const { getSettings } = await import("@/lib/hotel");
  const stripeConfig = resolveStripeConfig(await getSettings());
  if (!stripeConfig.secretKey) return;
  try { await stripeClient(stripeConfig.secretKey).checkout.sessions.expire(sessionId); } catch (error) { console.error("[Palacio] Stripe session expire:", error); }
}

export async function capturePayPalOrder(orderId: string, expectedAmount: number) {
  const { getSettings } = await import("@/lib/hotel");
  const paypal = resolvePaypalConfig(await getSettings());
  const token = await paypalToken(paypal);
  const response = await fetch(`${paypalBase(paypal.envMode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `capture-${orderId}` }, cache: "no-store" });
  const data = await response.json() as { status?: string; purchase_units?: { payments?: { captures?: { status?: string; amount?: { value?: string; currency_code?: string } }[] } }[] };
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return response.ok && data.status === "COMPLETED" && capture?.status === "COMPLETED" && capture.amount?.currency_code === "EUR" && Math.round(Number(capture.amount.value) * 100) === expectedAmount;
}
