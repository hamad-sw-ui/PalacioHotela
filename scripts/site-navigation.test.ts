import assert from "node:assert/strict";
import test from "node:test";
import { needsPageBack, pageBackFallback, pageBackTarget, safeInternalPath } from "../src/lib/site-navigation";

test("hubs stay without a back button", () => {
  assert.equal(needsPageBack("/"), false);
  assert.equal(needsPageBack("/hebergements"), false);
  assert.equal(pageBackFallback("/", ""), "");
  assert.equal(pageBackFallback("/hebergements", "categorie=accommodation"), "");
});

test("nested and private pages get a safe parent, never the browser", () => {
  assert.equal(pageBackFallback("/hebergements/suite-presidentielle"), "/hebergements");
  assert.equal(pageBackFallback("/pages/notre-histoire"), "/");
  assert.equal(pageBackFallback("/disponibilites"), "/");
  assert.equal(pageBackFallback("/contact"), "/");
  assert.equal(pageBackFallback("/compte"), "/");
  assert.equal(pageBackFallback("/devis"), "/");
  assert.equal(pageBackFallback("/devis", "itemId=4"), "/hebergements");
  assert.equal(pageBackFallback("/reservation", "itemId=4&checkIn=2026-10-01"), "/hebergements");
  assert.equal(pageBackFallback("/devis/suivi", "token=abc", true), "/compte");
  assert.equal(pageBackFallback("/devis/suivi", "token=abc", false), "/devis");
  assert.equal(pageBackFallback("/reservation/confirmation", "token=abc", true), "/compte");
  assert.equal(pageBackFallback("/reservation/confirmation", "token=abc", false), "/");
});

test("back prefers the last in-app page and otherwise a safe parent", () => {
  assert.equal(pageBackTarget("/hebergements/chambre-deluxe", "", false, "/hebergements?categorie=accommodation"), "/hebergements?categorie=accommodation");
  assert.equal(pageBackTarget("/hebergements/chambre-deluxe", "", false, ""), "/hebergements");
  assert.equal(pageBackTarget("/hebergements/chambre-deluxe", "", false, "https://example.com"), "/hebergements");
  assert.equal(pageBackTarget("/", "", false, "/contact"), "");
});

test("back never follows an external or technical address", () => {
  assert.equal(safeInternalPath("https://example.com"), "");
  assert.equal(safeInternalPath("//evil.test"), "");
  assert.equal(safeInternalPath("/api/quotes/1"), "");
  assert.equal(safeInternalPath("/admin?section=devis"), "");
  assert.equal(safeInternalPath("/hebergements?categorie=events"), "/hebergements?categorie=events");
});
