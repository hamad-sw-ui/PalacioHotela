import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingCanBeDeleted, planOnlineRefund } from "@/lib/booking-refund-plan";
import { adminCancellationPaymentNote, cancellationNotice, guestCancellationCopy } from "@/lib/mail";
import { refundPayPalOrderPayment, refundStripeCheckoutSession } from "@/lib/payments";

test("a paid card or PayPal stay is refunded on cancellation, except a started stay without confirmation", () => {
  const paid = { paymentMethod: "card", paymentStatus: "paid" };
  assert.equal(planOnlineRefund({ ...paid, status: "pending" }, { nextStatus: "cancelled" }), "refund");
  assert.equal(planOnlineRefund({ ...paid, paymentMethod: "paypal", status: "confirmed" }, { nextStatus: "cancelled" }), "refund");
  assert.equal(planOnlineRefund({ ...paid, status: "checked_in" }, { nextStatus: "cancelled" }), "manual");
  assert.equal(planOnlineRefund({ ...paid, status: "checked_out" }, { nextStatus: "cancelled", refundConfirmed: true }), "refund");
  assert.equal(planOnlineRefund({ ...paid, status: "cancelled" }, { nextStatus: "cancelled" }), "none");
  assert.equal(planOnlineRefund({ ...paid, status: "cancelled" }, { nextStatus: "cancelled", refundConfirmed: true }), "refund");
  assert.equal(planOnlineRefund({ ...paid, status: "confirmed" }, { nextStatus: "confirmed", refundConfirmed: true }), "none");
  assert.equal(planOnlineRefund({ paymentMethod: "cash", paymentStatus: "paid", status: "confirmed" }, { nextStatus: "cancelled" }), "none");
  assert.equal(planOnlineRefund({ paymentMethod: "card", paymentStatus: "awaiting_payment", status: "pending" }, { nextStatus: "cancelled" }), "none");
  assert.equal(planOnlineRefund({ paymentMethod: "paypal", paymentStatus: "refunded", status: "confirmed" }, { nextStatus: "cancelled" }), "none");
  assert.equal(bookingCanBeDeleted({ paymentMethod: "card", paymentStatus: "paid", status: "confirmed" }), false);
  assert.equal(bookingCanBeDeleted({ paymentMethod: "card", paymentStatus: "refunded", status: "cancelled" }), true);
  assert.equal(bookingCanBeDeleted({ paymentMethod: "cash", paymentStatus: "pay_on_site", status: "pending" }), true);
});

test("cancellation copy stays the same unless a refund just succeeded or failed", () => {
  assert.match(cancellationNotice({ paymentStatus: "unpaid", locale: "fr" }), /Aucun paiement/);
  assert.doesNotMatch(cancellationNotice({ paymentStatus: "unpaid", locale: "fr" }), /remboursement/);
  assert.match(cancellationNotice({ paymentStatus: "paid", locale: "fr" }), /contactera pour le remboursement/);
  assert.match(cancellationNotice({ paymentStatus: "paid", locale: "fr" }, "failed"), /contactera pour le remboursement/);
  assert.match(cancellationNotice({ paymentStatus: "paid", locale: "fr" }, "refunded"), /même moyen de paiement/);
  assert.match(cancellationNotice({ paymentStatus: "refunded", locale: "fr" }), /déjà été remboursé/);
  const guest = guestCancellationCopy({ paymentStatus: "unpaid", locale: "fr" }, "guest");
  assert.match(guest.body, /confirmons l’annulation/);
  assert.doesNotMatch(guest.footer, /remboursement/);
  assert.match(adminCancellationPaymentNote({ paymentStatus: "paid" }), /organisez le remboursement/);
  assert.match(adminCancellationPaymentNote({ paymentStatus: "paid", refundError: "Stripe indisponible" }, "failed"), /Stripe indisponible/);
  assert.match(adminCancellationPaymentNote({ paymentStatus: "refunded" }, "refunded"), /envoyé au client/);
  assert.match(adminCancellationPaymentNote({ paymentStatus: "pay_on_site" }), /Aucun paiement/);
});

test("Stripe refunds the stored checkout session and treats an existing refund as success", async () => {
  const calls: string[] = [];
  const refunded = await refundStripeCheckoutSession("cs_123", "palacio-refund-4", {
    retrieveSession: async (sessionId) => { calls.push(sessionId); return { payment_status: "paid", payment_intent: "pi_123" }; },
    createRefund: async (intentId, key) => { calls.push(`${intentId}:${key}`); return { id: "re_123", status: "succeeded" }; },
  });
  assert.deepEqual(refunded, { ok: true, refundRef: "re_123" });
  assert.deepEqual(calls, ["cs_123", "pi_123:palacio-refund-4"]);
  const again = await refundStripeCheckoutSession("cs_123", "palacio-refund-4", {
    retrieveSession: async () => ({ payment_status: "paid", payment_intent: { id: "pi_123" } }),
    createRefund: async () => { throw { code: "charge_already_refunded", message: "already refunded" }; },
  });
  assert.deepEqual(again, { ok: true, refundRef: "pi_123" });
  const missing = await refundStripeCheckoutSession("cs_123", "palacio-refund-4", {
    retrieveSession: async () => ({ payment_status: "unpaid", payment_intent: null }),
    createRefund: async () => { throw new Error("should not refund"); },
  });
  assert.equal(missing.ok, false);
});

test("PayPal refunds the captured order once and refuses a different amount", async () => {
  const calls: { url: string; method: string; requestId?: string }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    calls.push({ url: href, method: init?.method || "GET", requestId: new Headers(init?.headers).get("PayPal-Request-Id") || undefined });
    if (href.endsWith("/v2/checkout/orders/ORDER1")) return Response.json({ purchase_units: [{ payments: { captures: [{ id: "CAP1", status: "COMPLETED", amount: { value: "12.50", currency_code: "EUR" } }] } }] });
    if (href.endsWith("/v2/payments/captures/CAP1/refund")) return Response.json({ id: "REF1", status: "COMPLETED" });
    return new Response("missing", { status: 404 });
  }) as typeof fetch;
  const refunded = await refundPayPalOrderPayment({ orderId: "ORDER1", expectedCents: 1250, idempotencyKey: "palacio-refund-9", token: "tok", baseUrl: "https://paypal.test", fetchImpl });
  assert.deepEqual(refunded, { ok: true, refundRef: "REF1" });
  assert.equal(calls[1]?.method, "POST");
  assert.match(calls[1]?.url || "", /captures\/CAP1\/refund$/);
  assert.equal(calls[1]?.requestId, "palacio-refund-9");
  const mismatch = await refundPayPalOrderPayment({ orderId: "ORDER1", expectedCents: 1000, idempotencyKey: "palacio-refund-9", token: "tok", baseUrl: "https://paypal.test", fetchImpl });
  assert.equal(mismatch.ok, false);
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  const already = await refundPayPalOrderPayment({
    orderId: "ORDER1", expectedCents: 1250, idempotencyKey: "palacio-refund-9", token: "tok", baseUrl: "https://paypal.test",
    fetchImpl: (async () => Response.json({ purchase_units: [{ payments: { captures: [{ id: "CAP1", status: "REFUNDED", amount: { value: "12.50", currency_code: "EUR" } }], refunds: [{ id: "REF0", status: "COMPLETED" }] } }] })) as typeof fetch,
  });
  assert.deepEqual(already, { ok: true, refundRef: "REF0" });
});
