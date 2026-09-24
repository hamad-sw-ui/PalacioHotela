import "dotenv/config";
import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import pg from "pg";
import { PDFDocument } from "pdf-lib";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

async function json(path: string, init?: RequestInit) {
  const response = await fetch(`${BASE}${path}`, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

test("real quote lifecycle: create, persist, PDFs, admin send, sign and accept", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for the E2E test");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let quoteId = 0;
  let reference = "";
  let token = "";
  let signatureUrl = "";

  try {
    const health = await json("/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.body.ok, true);

    const restaurantResult = await client.query<{ id: number }>(
      "select id from catalog_items where category = 'restaurant' and active = true order by id limit 1",
    );
    const restaurantId = restaurantResult.rows[0]?.id;
    assert.ok(restaurantId, "An active restaurant catalog item is required");

    const created = await json("/api/v1/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: "Test E2E PDF V3",
        guestEmail: "quote-e2e@example.com",
        guestPhone: "+237600000099",
        requestKind: "restaurant",
        selectedItems: [{
          property_id: restaurantId,
          quantity: 2,
          order_dates: ["2027-06-10", "2027-06-11"],
          order_time: "13:00",
          meal_types: ["breakfast", "lunch", "dinner", "snacks", "other"],
        }],
        checkIn: "2027-06-10",
        checkOut: "2027-06-12",
        people: 2,
        message: "",
      }),
    });
    assert.equal(created.response.status, 201, created.body.error);
    reference = created.body.reference;
    token = created.body.token;
    assert.match(reference, /^DEV-\d{4}-\d{5}$/);
    assert.ok(token);

    const stored = await client.query(
      "select id, pdf_template_version, selected_items, estimated_total, status from quote_requests where public_token = $1",
      [token],
    );
    assert.equal(stored.rowCount, 1);
    quoteId = stored.rows[0].id;
    assert.equal(stored.rows[0].pdf_template_version, 3);
    assert.equal(stored.rows[0].status, "new");
    assert.equal(stored.rows[0].selected_items[0].order_time, "13:00");
    assert.equal(stored.rows[0].selected_items[0].meal_types.length, 5);
    assert.ok(stored.rows[0].estimated_total > 0);

    const receiptResponse = await fetch(`${BASE}${created.body.pdfUrl}`);
    assert.equal(receiptResponse.status, 200);
    assert.match(receiptResponse.headers.get("content-type") || "", /application\/pdf/);
    const receipt = await PDFDocument.load(await receiptResponse.arrayBuffer());
    assert.ok(receipt.getPages().length >= 1);
    assert.deepEqual(receipt.getPages()[0].getSize(), { width: 595, height: 842 });

    const login = await json("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login",
        email: process.env.ADMIN_EMAIL || "admin@palaciohotel.com",
        password: process.env.ADMIN_PASSWORD || "Palacio2026!",
      }),
    });
    assert.equal(login.response.status, 200, login.body.error);
    assert.ok(login.body.token);
    const adminHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${login.body.token}` };

    const previewResponse = await fetch(`${BASE}/api/admin/quotes/${quoteId}/pdf?kind=quote`, {
      headers: { Authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(previewResponse.status, 200);
    assert.match(previewResponse.headers.get("content-disposition") || "", /inline/);

    const sent = await json("/api/admin/manage", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        resource: "quotes",
        action: "send",
        id: quoteId,
        data: { amountTtc: 650000, validUntil: "2027-12-31", adminNotes: "Conditions du test E2E." },
      }),
    });
    assert.equal(sent.response.status, 200, sent.body.error);
    assert.equal(sent.body.result.status, "quote_sent");
    assert.equal(sent.body.result.pdfTemplateVersion, 3);

    const finalResponse = await fetch(`${BASE}/api/quotes/${token}/pdf?kind=quote`);
    assert.equal(finalResponse.status, 200);
    const finalPdf = await PDFDocument.load(await finalResponse.arrayBuffer());
    assert.ok(finalPdf.getPages().length >= 1);

    const tinyPng = Buffer.concat([
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
      Buffer.alloc(64),
    ]);
    const signed = await json(`/api/quotes/${token}/signature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signerName: "Client E2E", signature: `data:image/png;base64,${tinyPng.toString("base64")}` }),
    });
    assert.equal(signed.response.status, 200, signed.body.error);
    signatureUrl = signed.body.signatureUrl;
    assert.match(signatureUrl, /^\/api\/media\/.+\.png$/);

    const accepted = await json(`/api/quotes/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "User-Agent": "Palacio-E2E-Test" },
      body: JSON.stringify({ action: "accept" }),
    });
    assert.equal(accepted.response.status, 200, accepted.body.error);
    assert.equal(accepted.body.status, "accepted");

    const finalStored = await client.query(
      "select status, amount_ttc, client_signer_name, client_signed_at, client_acceptance_user_agent from quote_requests where id = $1",
      [quoteId],
    );
    assert.equal(finalStored.rows[0].status, "accepted");
    assert.equal(finalStored.rows[0].amount_ttc, 650000);
    assert.equal(finalStored.rows[0].client_signer_name, "Client E2E");
    assert.ok(finalStored.rows[0].client_signed_at);
    assert.equal(finalStored.rows[0].client_acceptance_user_agent, "Palacio-E2E-Test");
  } finally {
    if (quoteId) {
      await client.query("delete from activity_logs where entity = 'quote' and entity_id = $1", [quoteId]);
      await client.query("delete from notifications where message = $1 or title like $2", [reference, `%${reference}%`]);
      const removed = await client.query("delete from quote_requests where id = $1 returning id", [quoteId]);
      assert.equal(removed.rowCount, 1, "The E2E quote must be removed after the test");
    }
    if (signatureUrl) {
      const filename = signatureUrl.slice("/api/media/".length);
      await unlink(join(process.cwd(), "public", "uploads", "media", filename)).catch(() => {});
    }
    await client.end();
  }
});
