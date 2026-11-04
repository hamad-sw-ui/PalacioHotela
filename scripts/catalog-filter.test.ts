import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogItem } from "../src/db/schema";
import { filterCatalog } from "../src/lib/catalog-filter";

function item(id: number, category: CatalogItem["category"]): CatalogItem {
  return { id, slug: `item-${id}`, category, nameFr: `Article ${id}`, nameEn: `Item ${id}`, descriptionFr: "", descriptionEn: "", image: "", images: [], features: [], price: 1000, pricingUnit: "night", capacity: 2, inventory: 1, amenitiesFr: [], amenitiesEn: [], featured: false, active: true, createdAt: new Date(), updatedAt: new Date() };
}

const catalog: CatalogItem[] = [
  item(1, "accommodation"),
  item(2, "accommodation"),
  item(3, "conference_room"),
  item(4, "event_hall"),
  item(5, "service"),
  item(6, "restaurant"),
];

test("each catalog tab keeps only its own category", () => {
  assert.deepEqual(filterCatalog(catalog, "accommodation").map((entry) => entry.id), [1, 2]);
  assert.deepEqual(filterCatalog(catalog, "conference_room").map((entry) => entry.id), [3]);
  assert.deepEqual(filterCatalog(catalog, "event_hall").map((entry) => entry.id), [4]);
  assert.deepEqual(filterCatalog(catalog, "service").map((entry) => entry.id), [5]);
  assert.deepEqual(filterCatalog(catalog, "restaurant").map((entry) => entry.id), [6]);
});

test("the events tab gathers conference rooms and event halls together", () => {
  assert.deepEqual(filterCatalog(catalog, "events").map((entry) => entry.id), [3, 4]);
});

test("an absent, empty or unknown category shows the whole catalog", () => {
  assert.equal(filterCatalog(catalog, "all").length, catalog.length);
  assert.equal(filterCatalog(catalog, null).length, catalog.length);
  assert.equal(filterCatalog(catalog, "").length, catalog.length);
  assert.equal(filterCatalog(catalog, "hacker-input").length, catalog.length);
});

test("an empty catalog stays empty under every filter", () => {
  for (const key of ["all", "accommodation", "events", "restaurant", "unknown"]) {
    assert.equal(filterCatalog([], key).length, 0);
  }
});
