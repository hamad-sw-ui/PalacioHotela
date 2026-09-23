import Stripe from "stripe";
import type { Booking } from "@/db/schema";

export function paymentConfiguration() {
  const rate = Number(process.env.PAYPAL_XAF_PER_EUR || "0");
  return { card: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET), paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && rate > 0), cash: true, paypalRate: rate > 0 ? rate : null };
}

export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function createStripeCheckout(booking: Booking, origin: string) {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"], customer_email: booking.guestEmail,
    line_items: [{ price_data: { currency: "xaf", unit_amount: booking.total, product_data: { name: `${booking.itemName} · ${booking.reference}`, description: `${booking.checkIn} → ${booking.checkOut}` } }, quantity: 1 }],
    success_url: `${origin}/reservation/confirmation?token=${booking.publicToken}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/reservation/confirmation?token=${booking.publicToken}&cancelled=1`,
    metadata: { bookingId: String(booking.id), reference: booking.reference || "" },
  }, { idempotencyKey: `palacio-booking-${booking.id}` });
  if (!session.url) throw new Error("Stripe did not return a payment URL");
  return { url: session.url, reference: session.id, amount: booking.total, currency: "XAF" };
}

const paypalBase = () => process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function paypalToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) throw new Error("PayPal is not configured");
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
  if (!response.ok) throw new Error("PayPal authentication failed");
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

export async function createPayPalOrder(booking: Booking, origin: string) {
  const rate = Number(process.env.PAYPAL_XAF_PER_EUR || "0");
  if (!rate || !Number.isFinite(rate)) throw new Error("PayPal XAF/EUR conversion rate is not configured");
  const value = (booking.total / rate).toFixed(2);
  const token = await paypalToken();
  const response = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `palacio-${booking.id}` },
    body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: booking.reference, description: booking.itemName, amount: { currency_code: "EUR", value } }], payment_source: { paypal: { experience_context: { brand_name: "Palacio Hotel", locale: booking.locale === "en" ? "en-US" : "fr-FR", user_action: "PAY_NOW", return_url: `${origin}/api/payments/paypal/return?booking=${booking.publicToken}`, cancel_url: `${origin}/reservation/confirmation?token=${booking.publicToken}&cancelled=1` } } } }),
    cache: "no-store",
  });
  const data = await response.json() as { id?: string; links?: { rel: string; href: string }[]; message?: string };
  if (!response.ok || !data.id) throw new Error(data.message || "PayPal order creation failed");
  const url = data.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  if (!url) throw new Error("PayPal did not return an approval URL");
  return { url, reference: data.id, amount: Math.round(Number(value) * 100), currency: "EUR", displayValue: value };
}

export async function capturePayPalOrder(orderId: string, expectedAmount: number) {
  const token = await paypalToken();
  const response = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `capture-${orderId}` }, cache: "no-store" });
  const data = await response.json() as { status?: string; purchase_units?: { payments?: { captures?: { status?: string; amount?: { value?: string; currency_code?: string } }[] } }[] };
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return response.ok && data.status === "COMPLETED" && capture?.status === "COMPLETED" && capture.amount?.currency_code === "EUR" && Math.round(Number(capture.amount.value) * 100) === expectedAmount;
}
