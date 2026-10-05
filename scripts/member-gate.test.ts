import assert from "node:assert/strict";
import test from "node:test";
import { memberHref, returnAfterSignIn, signInHref } from "../src/lib/member-gate";

test("a guest is sent to sign-in and returns to the booking or quote", () => {
  assert.equal(memberHref(false, "/reservation"), "/compte?next=%2Freservation");
  assert.equal(memberHref(false, "/devis?itemId=3"), "/compte?next=%2Fdevis%3FitemId%3D3");
  assert.equal(memberHref(true, "/reservation?checkIn=2026-10-01"), "/reservation?checkIn=2026-10-01");
  assert.equal(returnAfterSignIn("/hebergements/chambre-deluxe"), "/hebergements/chambre-deluxe");
});

test("sign-in never follows an address outside the hotel site", () => {
  assert.equal(signInHref("https://example.com"), "/compte");
  assert.equal(signInHref("//example.com"), "/compte");
  assert.equal(returnAfterSignIn("/devis/suivi?token=abc"), "");
  assert.equal(returnAfterSignIn("/reservation/confirmation?token=abc"), "");
});
