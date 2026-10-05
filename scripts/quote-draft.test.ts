import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_QUOTE_DRAFT,
  markQuoteDraftSent,
  quoteDraftHasLines,
  quoteDraftWasSent,
  readQuoteDraft,
  releaseQuoteDraft,
  writeQuoteDraft,
  type QuoteDraft,
  type QuoteDraftStore,
} from "../src/lib/quote-draft";

function memory(): QuoteDraftStore {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value); },
    removeItem: (key) => { items.delete(key); },
  };
}

function selection(): QuoteDraft {
  return {
    accommodationLines: [{ id: "stay", property_id: 1, type: "accommodation", quantity: 1, check_in: "2027-03-01", check_out: "2027-03-04" }],
    roomLines: [{ id: "hall", property_id: 2, type: "room", quantity: 1 }],
    serviceLines: [{ id: "spa", property_id: 3, type: "service", quantity: 2 }],
    restaurantLines: [{ id: "table", property_id: 4, type: "restaurant", quantity: 1, meal_types: ["dinner"], order_dates: ["2027-03-02"], order_time: "20:00" }],
    formSnapshot: { name: "Amina", email: "amina@example.com", phone: "+237600000000", message: "Anniversaire", people: 4, checkIn: "2027-03-01", checkOut: "2027-03-04" },
  };
}

test("an unfinished quote keeps every chosen line until it is sent", () => {
  const storage = memory();
  writeQuoteDraft(storage, selection());
  const draft = readQuoteDraft(storage);
  assert.equal(quoteDraftWasSent(storage), false);
  assert.equal(draft.accommodationLines.length, 1);
  assert.equal(draft.roomLines[0]?.property_id, 2);
  assert.equal(draft.serviceLines[0]?.quantity, 2);
  assert.equal(draft.restaurantLines[0]?.order_time, "20:00");
  assert.equal(draft.formSnapshot.checkIn, "2027-03-01");
  assert.equal(quoteDraftHasLines(draft), true);
});

test("a sent quote stays empty when the form tries to save the selection again", () => {
  const storage = memory();
  const chosen = selection();
  writeQuoteDraft(storage, chosen);
  markQuoteDraftSent(storage);
  assert.equal(quoteDraftWasSent(storage), true);
  storage.setItem("quote_draft", JSON.stringify(chosen));
  assert.equal(quoteDraftHasLines(readQuoteDraft(storage)), false);
  assert.deepEqual(readQuoteDraft(storage), EMPTY_QUOTE_DRAFT);
  writeQuoteDraft(storage, chosen);
  assert.equal(storage.getItem("quote_draft"), null);
  assert.equal(quoteDraftHasLines(readQuoteDraft(storage)), false);
  releaseQuoteDraft(storage);
  const next = { ...EMPTY_QUOTE_DRAFT, accommodationLines: [{ id: "next", property_id: 9, type: "accommodation" as const, quantity: 1 }] };
  writeQuoteDraft(storage, next);
  const saved = readQuoteDraft(storage);
  assert.equal(saved.accommodationLines.length, 1);
  assert.equal(saved.accommodationLines[0]?.property_id, 9);
  assert.equal(saved.roomLines.length, 0);
});
